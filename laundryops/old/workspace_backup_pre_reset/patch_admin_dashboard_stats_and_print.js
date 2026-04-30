// 1. 대시보드 통계 (오늘/이달의 매출 등) + TOP 10 랭킹 (정액제는 정액금액만 반영, 명세서 무시)
window.calculateAdminDashStats = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    
    // Top 10 집계를 위한 객체
    const hotelSales = {};

    // 1. 단가제 거래처의 명세서 매출만 합산! (정액제 호텔 제외)
    // invoices 와 hotels 조인해서 contract_type 이 'unit' 인 경우만 반영
    const { data: invData } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, hotels!inner(name, contract_type)')
        .eq('factory_id', currentFactoryId)
        .eq('hotels.contract_type', 'unit');
        
    if(invData) {
        invData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음';
            const supplyPrice = inv.total_amount;
            if(inv.date === todayStr) todayRev += supplyPrice;
            if(inv.date.startsWith(curMonth)) {
                monthRev += supplyPrice;
                hotelSales[hName] = (hotelSales[hName] || 0) + supplyPrice;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += supplyPrice;
        });
    }

    // 2. 정액제 거래처 매출 합산 (명세서 유무 상관없이 한 달에 한 번 fixed_amount 합산)
    const { data: hotelData } = await window.mySupabase.from('hotels')
        .select('name, contract_type, fixed_amount')
        .eq('factory_id', currentFactoryId);
        
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
                // 정액제는 '오늘' 매출에는 보통 안 잡지만, 이달/지난달 매출에는 잡음
                monthRev += fixAmt;
                prevMonthRev += fixAmt;
                hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
            }
        });
    }

    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';

    const el3 = document.getElementById('adminGrowth');
    if(prevMonthRev === 0) {
        if(el3) el3.innerHTML = monthRev > 0 ? '<span style="color:var(--success);">&#9650; 100%</span>' : '-';
    } else {
        const growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
        if(el3) el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    }

    // Top 10 그리기
    const titleEl = document.getElementById('rankingTitle');
    if (titleEl) {
        // parts[0] 년, parts[1] 월
        titleEl.innerHTML = `${parts[0]}년 ${parts[1]}월 매출 TOP 10`;
    }
    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
        if(sorted.length === 0) {
            rankingArea.innerHTML = '<div style="color:gray;">데이터가 없습니다.</div>';
        } else {
            const top10 = sorted.slice(0, 10);
            rankingArea.innerHTML = '<table style="width:100%; border-collapse:collapse; text-align:left;"><tbody>' + 
            top10.map((f, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:8px 0; color: #475569;">${i+1}위</td>
                    <td style="padding:8px 0; font-weight:600;">${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary); padding:8px 0;">${f[1].toLocaleString()}원</td>
                </tr>
            `).join('') + '</tbody></table>';
        }
    }
    
    // 현장직원 수 로드
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) el4.innerText = activeHotels + ' / ' + (staffCount || 0);
};

// 트렌드 차트 (그래프) - 역시 정액제는 고정금액, 단가제는 명세서 공급가액 기준
window.updateTrendChartOnly = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // 1. 단가제 명세서 매출 합산
    let invQuery = window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, hotels!inner(contract_type)')
        .eq('factory_id', currentFactoryId)
        .eq('hotels.contract_type', 'unit');
        
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                const supplyPrice = inv.total_amount;
                monthlyTrend[mKey] += supplyPrice;
            }
        });
    }
    
    // 2. 정액제 고정 매출 합산
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};

// 2. 인쇄 / 발송 팝업 공통 처리 (특수거래처 2단, 일반거래처 매트릭스, 공급가만)

window.buildPrintAndSendReport = async function(hotelId, sDate, eDate) {
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return null; }
    
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return null; }

    const { data: allItems } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hotelId).order('created_at');

    let supplyPrice = 0;
    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            supplyPrice += (Number(it.qty) * Number(it.price));
        });
    });

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타');
        orderedCats.forEach(c => grouped[c] = {});

        const catMap = {};
        if (allItems) {
            allItems.forEach(ai => {
                const cat = ai.category_name || '기타';
                catMap[ai.name.toLowerCase()] = cat;
                if(!grouped[cat]) grouped[cat] = {};
                grouped[cat][ai.name] = { name: ai.name, price: Number(ai.price), qty: 0, amount: 0 };
            });
        }

        list.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                const lowerName = (it.name||'').toLowerCase();
                const cat = catMap[lowerName] || '기타';
                if(!grouped[cat]) grouped[cat] = {};
                
                let exactKey = Object.keys(grouped[cat]).find(k => k.toLowerCase() === lowerName);
                if (!exactKey) {
                    exactKey = it.name;
                    grouped[cat][exactKey] = { name: it.name, price: Number(it.price), qty: 0, amount: 0 };
                }
                
                const q = Number(it.qty) || 0;
                grouped[cat][exactKey].qty += q;
                grouped[cat][exactKey].amount += (q * Number(it.price));
                if (q > 0) grouped[cat][exactKey].price = Number(it.price);
            });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || Object.keys(grouped[cat]).length === 0) return;
            const itemsInCat = Object.values(grouped[cat]);
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <div style="overflow-x:auto;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${itemsInCat.map(it => {
                            return `<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                                <td style="padding:2px; text-align:right;">₩ ${it.amount.toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                </div>
            </div>`;
        });

        reportHtml = `
            <div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래처 발송용 명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; text-align:right; font-weight:700;">
                    공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ ${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}
                </div>
            </div>`;
            
    } else {
        const itemPrices = {};
        if (allItems) {
            allItems.forEach(ai => {
                itemPrices[ai.name] = Number(ai.price);
            });
        }

        const dateSequence = [];
        let curDate = new Date(sDate);
        const endD = new Date(eDate);
        while (curDate <= endD) {
            const y = curDate.getFullYear();
            const m = String(curDate.getMonth() + 1).padStart(2, '0');
            const d = String(curDate.getDate()).padStart(2, '0');
            dateSequence.push(`${y}-${m}-${d}`);
            curDate.setDate(curDate.getDate() + 1);
        }

        const matrix = {};
        dateSequence.forEach(d => matrix[d] = {});

        list.forEach(inv => {
            if (!matrix[inv.date]) {
                matrix[inv.date] = {};
                if (!dateSequence.includes(inv.date)) {
                    dateSequence.push(inv.date);
                    dateSequence.sort();
                }
            }
            (inv.invoice_items || []).forEach(it => {
                let exactKey = Object.keys(itemPrices).find(k => k.toLowerCase() === (it.name||'').toLowerCase());
                const q = Number(it.qty) || 0;
                
                if (!exactKey) {
                    exactKey = it.name;
                    itemPrices[exactKey] = Number(it.price);
                } else if (q > 0) {
                    itemPrices[exactKey] = Number(it.price); 
                }
                matrix[inv.date][exactKey] = (matrix[inv.date][exactKey] || 0) + q;
            });
        });

        const allItemsNames = Object.keys(itemPrices).sort((a, b) => {
            const idxA = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === a.toLowerCase()) : -1;
            const idxB = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === b.toLowerCase()) : -1;
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        const qtyTotals = {};
        const priceTotals = {};
        
        allItemsNames.forEach(name => {
            let totalQty = 0;
            dateSequence.forEach(d => {
                totalQty += (matrix[d][name] || 0);
            });
            qtyTotals[name] = totalQty;
            
            let exactLineSum = 0;
            list.forEach(inv => {
                (inv.invoice_items || []).forEach(it => {
                    if ((it.name||'').toLowerCase() === name.toLowerCase()) {
                        exactLineSum += (Number(it.qty) * Number(it.price));
                    }
                });
            });
            priceTotals[name] = exactLineSum;
        });

        reportHtml = `
            <div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="overflow-x:auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 12px; min-width: 600px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding: 4px; border: 1px solid #cbd5e1;">일자</th>
                            ${allItemsNames.map(name => `<th style="padding: 4px; border: 1px solid #cbd5e1;">${name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${dateSequence.map(d => `
                            <tr>
                                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">${parseInt(d.substring(8))}</td>
                                ${allItemsNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">${matrix[d][name] || 0}</td>`).join('')}
                            </tr>
                        `).join('')}
                        <tr style="background:#f1f5f9; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">수량 합계</td>
                            ${allItemsNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">${qtyTotals[name]}</td>`).join('')}
                        </tr>
                        <tr style="background:#f9fafb; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">단가</td>
                            ${allItemsNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${itemPrices[name].toLocaleString()}</td>`).join('')}
                        </tr>
                        <tr style="background:#fffbeb; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">항목 합계</td>
                            ${allItemsNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${priceTotals[name].toLocaleString()}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; text-align:right; font-weight:700;">
                    공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ ${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}
                </div>
            </div>`;
    }

    return { html: reportHtml, hName: h.name, list: list };
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const report = await window.buildPrintAndSendReport(hotelFilter, sDate, eDate);
    if(!report) return;

    document.getElementById('invoiceDetailArea').innerHTML = report.html + `
        <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px;">🖨️ 인쇄창 열기</button>
        </div>`;
    openModal('invoiceDetailModal');
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const report = await window.buildPrintAndSendReport(hotelFilter, sDate, eDate);
    if(!report) return;

    // 모달 내용물 안에 발송 버튼을 직접 박아넣음
    let finalHtml = report.html + `
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 40px; cursor: pointer; font-size: 16px; font-weight:700; background:var(--primary); color:white; border:none; border-radius:8px;">✈️ 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = finalHtml;
    
    // 발송 버튼 클릭 이벤트
    const btn = document.getElementById('sendInvBtn');
    if(btn) {
        btn.onclick = async function() {
            if(confirm(`${report.hName} 거래처로 월정산 명세서를 발송하시겠습니까?`)) {
                const ids = report.list.map(inv => inv.id);
                
                // 1. DB 업데이트 (invoices 테이블)
                // [v38 변경] sent_group_id에 기간 정보를 직접 포함시켜 로컬저장소 의존성 제거
                const groupId = `g_${sDate}_${eDate}_${Date.now()}`;
                await window.mySupabase.from('invoices').update({ is_sent: true, sent_group_id: groupId }).in('id', ids);
                
                // 2. [v38 변경] 로컬스토리지 의존성 제거 (로직 삭제)
                alert('발송 요청이 완료되었습니다.');
                
                if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices(); 
                if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList(); 
                closeModal('sendInvoiceModal');
            }
        };
    }
    openModal('sendInvoiceModal');
};


// [추가 패치] 3가지 팝업 (인쇄/발송 팝업, 발송내역 팝업, 파트너 수신함 팝업) 모두 부가세/총합계 포함되게 복구
window.viewSentDetail = async function(hotelName, period, groupId, isPartnerView) {
    const { data: hotels } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).eq('name', hotelName);
    const h = hotels && hotels.length > 0 ? hotels[0] : null;

    if (!h) {
        alert('거래처 정보를 찾을 수 없습니다.');
        return;
    }

    let sDate, eDate;
    if (period.includes('~')) {
        [sDate, eDate] = period.split(' ~ ').map(s => s.trim());
    } else {
        sDate = period;
        eDate = period;
    }

    // 인쇄/발송 팝업용 함수 재사용
    const report = await window.buildPrintAndSendReport(h.id, sDate, eDate);
    if (!report) return;

    let finalHtml = report.html;
    
    // 파트너 뷰일 때 정산 버튼 추가 로직
    if (isPartnerView) {
        const isConfirmed = h.confirmed_months && (h.confirmed_months[groupId] === true);
        const confirmBtnHtml = !isConfirmed ? `<button class="btn btn-save no-print" style="padding: 15px 40px; cursor: pointer; font-size: 16px; background:#10b981; border:none; color:white; font-weight:700;" onclick="confirmSentReportByPeriod('${groupId}')">✅ 정산 확인 완료</button>` : '<div style="color: var(--success); font-weight: 700; font-size: 16px;">✅ 이미 확인된 내역입니다.</div>';
        finalHtml += `
        <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄하기</button>
            ${confirmBtnHtml}
        </div>`;
    } else {
        finalHtml += `
        <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄창 열기</button>
        </div>`;
    }

    const detailArea = document.getElementById('invoiceDetailArea');
    if (detailArea) {
        detailArea.innerHTML = finalHtml;
        openModal('invoiceDetailModal');
    } else {
        alert('상세내역을 불러왔습니다 (모달 영역이 없습니다).');
    }
};

window.viewSentReportByPeriod = async function(period, groupId) {
    const hId = currentHotelId;
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    await window.viewSentDetail(h.name, period, groupId, true);
};
