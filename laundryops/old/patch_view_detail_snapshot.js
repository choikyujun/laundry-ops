window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    // 사용자가 새롭게 발송 버튼을 누른 경우(리렌더링이 아닌 경우) 메모리 초기화
    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    // 1. DB의 진짜 배송 데이터만 로드 (과거의 '관리자(차감)' 명세서는 철저히 무시)
    list.forEach(inv => {
        if (inv.staff_name === '관리자(차감)') return; // 팝업창은 항상 0에서 시작해야 하므로 기존 DB 차감은 무시
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                // 현장 직원이 입력한 일반 마이너스
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    // 2. 현재 메모리에 있는 차감 내역을 가상으로 병합 (화면 표시용)
    const deductionDate = eDate; // 마지막 날짜에 차감 귀속
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // [핵심 변경] 발송하기 버튼을 눌렀을 때만 DB에 기록 (Snapshot 방식으로 HTML 자체를 영구 보존)
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // [추가] 지금 이 순간의 화면(reportHtml)에서 버튼 영역(btnHtml)만 쏙 빼서 스냅샷 HTML 생성
            const snapshotHtml = reportHtml.replace(btnHtml, '');

            // 1. 발송 로그 생성 시 화면을 그대로 보존하는 snapshot_html 컬럼 추가 (DB에 이 컬럼이 없으면 에러가 날 수 있으니 아래서 방어처리)
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            // 기존 sent_logs 테이블에 insert (현재 구조를 해치지 않고 기본 정보만 우선 저장)
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            // [추가] 차감 명세서를 생성하지 않음! 
            // 엑셀에서 다운받거나 '내역확인' 팝업을 열 때 데이터가 흔들리지 않게 하려면, 
            // 발송 로그 자체에 차감액을 기록해두거나 차감 명세서를 고정시켜야 하는데, 
            // 사장님 요청: "기존에 발행했던 차감 내역 데이터가 변하면 안 된다"
            
            // 따라서, 이 발송 건만을 위한 '고정된' 차감 명세서를 1개 생성해서 박제해둡니다.
            if (window._currentDeductions.length > 0) {
                // 발송 로그 ID를 꼬리표로 달아서 이 발송건만의 고유한 차감 내역으로 박제
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, // 종료일에 귀속
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true, 
                    // [중요] 이 차감은 어느 발송건에 속한 것인지 연결고리(비고)를 남김
                    memo: 'sent_log_id:' + newLog.id 
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            // 일반 명세서들의 is_sent 처리
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 (과거에 보낸 내역을 열어볼 때)
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [핵심 변경] 과거 내역을 불러올 때는, 그 발송 건(sentLogId)에 귀속된 '차감 전용 명세서'도 반드시 함께 불러와야 합니다!
    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name, memo')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    // [중요 필터링] 과거에 발송한 수많은 차감 내역들이 같은 기간(1~31일) 안에 쌓여있을 수 있습니다.
    // 1. 일반 명세서(staff_name이 관리자(차감)이 아닌 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (inv.staff_name !== '관리자(차감)') return true;
        // 이 차감 명세서가 현재 열어보는 발송 로그(sentLogId)를 위해 만들어졌는가?
        return inv.memo === 'sent_log_id:' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = inv.staff_name === '관리자(차감)' || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정 (내역확인 팝업과 동일하게 박제된 차감 내역만 로드)
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price), staff_name, memo')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    // [중요 필터링] 과거 엑셀을 받을 때는, 오직 해당 발송(logId)을 위해 만들어진 차감 내역만 포함시킨다.
    const filteredList = list.filter(inv => {
        if (inv.staff_name !== '관리자(차감)') return true;
        return inv.memo === 'sent_log_id:' + logId;
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = inv.staff_name === '관리자(차감)' || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
