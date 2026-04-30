window.loadAdminDashboard = async function() {
    console.log("DEBUG: [v37] loadAdminDashboard DB version started");

    const statsMonth = document.getElementById('adminStatsMonth');
    if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);
    const curMonth = statsMonth ? statsMonth.value : getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    // 1. 공장 정보 및 구독 상태 로드
    const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!f) return;

    // 구독 배너
    const subStatusLeft = document.getElementById('subStatusLeft');
    const subPlanRight = document.getElementById('subPlanRight');
    const subBanner = document.getElementById('subBanner');
    
    if (subStatusLeft && subPlanRight && subBanner) {
        const subLabel = f.sub_status === 'expired' ? '만료됨' : (f.sub_status === 'expiring' ? '만료임박' : '활성(사용중)');
        subStatusLeft.innerHTML = '구독상태: ' + subLabel;
        subPlanRight.innerHTML = '요금제: ' + (f.plan || '라이트') + ' | 만료일: ' + (f.plan_expiry || '제한없음');
        subBanner.style.background = f.sub_status === 'expired' ? '#fee2e2' : (f.sub_status === 'expiring' ? '#fef3c7' : '#e0f2fe');
    }

    // 2. 매출 요약 계산 (DB 조회)
    await window.calculateAdminDashStats();

    // 3. 거래처 드롭다운 업데이트
    const { data: hotels } = await window.mySupabase
        .from('hotels')
        .select('id, name')
        .eq('factory_id', currentFactoryId)
        .order('name');

    ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
        const select = document.getElementById(id);
        if(select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="all">전체 거래처</option>';
            if(hotels) hotels.forEach(h => select.innerHTML += '<option value="' + h.id + '">' + h.name + '</option>');
            select.value = currentVal || 'all';
        }
    });

    // 4. 거래명세서 목록 로드 및 차트 데이터 갱신
    await window.loadAdminRecentInvoices();
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    const { data: hotelData } = await window.mySupabase.from('hotels').select('contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    if(hotelData) {
        hotelData.forEach(h => {
            if(h.contract_type === 'fixed') {
                for (const m in monthlyTrend) {
                    monthlyTrend[m] += Number(h.fixed_amount || 0);
                }
            }
        });
    }

    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    window.updateRevenueTrendChart(monthlyTrend, hotelFilter === 'all' ? '전체' : '선택 거래처');
};

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
    
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    let hotelQuery = window.mySupabase.from('hotels').select('name, contract_type, fixed_amount').eq('factory_id', currentFactoryId);
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

    // 1. 단가제 매출 (invoices)
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount, hotel_id, hotels(name)').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) {
                monthRev += inv.total_amount;
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                hotelSales[hName] = (hotelSales[hName] || 0) + inv.total_amount;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += inv.total_amount;
        });
    }

    // 2. 정액제 매출 합산 (hotels)
    const { data: hotelData } = await window.mySupabase.from('hotels').select('name, contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
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
    
    let growth = 0;
    if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) el4.innerText = activeHotels + ' / ' + (staffCount || 0);

    // [v37] 매출 TOP 10 업데이트
    const rankingTitle = document.getElementById('rankingTitle');
    if(rankingTitle) rankingTitle.innerText = `${curMonth} 거래처 매출 TOP 10`;

    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const top10 = Object.entries(hotelSales).sort((a,b) => b[1]-a[1]).slice(0, 10);
        if (top10.length === 0) {
            rankingArea.innerHTML = '<div style="text-align:center; color:var(--secondary); padding: 20px;">매출 데이터가 없습니다.</div>';
        } else {
            rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>거래처명</th><th>이번 달 매출</th></tr></thead><tbody>' +
            top10.map((f, i) => `
                <tr>
                    <td>${i+1}위</td>
                    <td>${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary);">${f[1].toLocaleString()}원</td>
                </tr>
            `).join('') + '</tbody></table>';
        }
    }
};
window.loadAdminRecentInvoices = async function(returnList = false) {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
    const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
    const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

    let query = window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);

    if (sDate) query = query.gte('date', sDate);
    if (eDate) query = query.lte('date', eDate);
    if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

    const { data, error } = await query.order('date', { ascending: false }).limit(100);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
        const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
        const statusBadge = inv.is_sent 
            ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

        tbody.innerHTML += `
        <tr>
            <!-- 체크박스 열 추가 -->
            <td><input type="checkbox" class="invoice-checkbox" value="${inv.id}"></td>
            <td>${inv.date}</td>
            <td style="font-weight:700; color:var(--primary);">${hName}</td>
            <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
            <td>${cType}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
            </td>
        </tr>`;
    });
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    // contract_type === 'special' 로 간주할지, hotelType 필드가 따로 있는지 확인. 여기서는 임의로 호환.
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
        const ids = list.map(inv => inv.id);
        await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
        
        alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
        window.loadAdminRecentInvoices(); 
    }
};
let isInvoiceLoading = false;
window.loadAdminRecentInvoices = async function(returnList = false) {
    if (isInvoiceLoading) return; // 중복 호출 방지
    isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId);

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } finally {
        isInvoiceLoading = false;
    }
};
window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        (inv.items || []).forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        </body></html>`;
    } else {
        reportHtml = `
        <html><head><style>@page { size: A5; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; } table { width:100%; border-collapse:collapse; margin-top:20px; } th, td { border:1px solid #000; padding:8px; font-size:12px; } th { background:#f1f5f9; text-align:center; } td.num { text-align:right; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">거래명세서</h1>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div style="font-weight:700; font-size:18px;">${inv.hotels?inv.hotels.name:''} 귀하</div>
                <div style="text-align:right; font-size:12px;">일자: ${inv.date}<br>담당자: ${inv.staff_name||''}</div>
            </div>
            <table>
                <thead><tr><th>품목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
                <tbody>
                    ${(inv.items || []).map(it => `<tr>
                        <td>${it.name}</td>
                        <td class="num">${it.qty}</td>
                        <td class="num">${Number(it.price||0).toLocaleString()}</td>
                        <td class="num">${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; background:#eff6ff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:18px;">총 합계: ₩ ${total.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, items, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name || '-'}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.qty || 0).toLocaleString()}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;

    } else {
        // [일반거래처] 매트릭스 방식 복원
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*') // items 포함 전체 컬럼
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('에러: ' + error.message); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + Number(it.qty||0);
            itemInfoMap[it.name] = { price: Number(it.price) || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        (inv.items || []).forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        </div>`;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">거래명세서</h1>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div style="font-weight:700; font-size:18px;">${inv.hotels?inv.hotels.name:''} 귀하</div>
                <div style="text-align:right; font-size:12px;">일자: ${inv.date}<br>담당자: ${inv.staff_name||''}</div>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                <thead><tr><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">품목</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">수량</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">단가</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">금액</th></tr></thead>
                <tbody>
                    ${(inv.items || []).map(it => `<tr>
                        <td style="border:1px solid #000; padding:8px; font-size:12px;">${it.name}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${it.qty}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${Number(it.price||0).toLocaleString()}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; background:#eff6ff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:18px;">총 합계: ₩ ${total.toLocaleString()}</div>
            </div>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('report-to-print')" style="padding:10px 30px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    // [v37] 수정: items 포함해서 가져오기 (총합계 계산용)
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error) { alert('에러: ' + error.message); return; }
    if(!list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = `
        <div style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
            <h2 style="text-align:center;">정산명세서 발송 (${h.name})</h2>
            <div style="text-align:right; margin-bottom:10px;">조회 기간: ${sDate} ~ ${eDate}</div>
            
            <div style="margin-top:20px; padding:20px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="color:var(--secondary); font-size:14px;">공급가: ₩ ${supplyPrice.toLocaleString()} <br> 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-size:22px; color:var(--primary);">총 발송금액: ₩ ${totalAmount.toLocaleString()}</div>
            </div>

            <div style="text-align:center; margin-top:30px;">
                <button id="sendInvBtn" style="padding: 15px 40px; font-size: 18px; cursor:pointer; background:var(--primary); color:white; border:none; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    🚀 카카오톡 알림톡 발송하기 (${list.length}건)
                </button>
            </div>
        </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 정산명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            window.loadAdminRecentInvoices(); 
        }
    };
    
    openModal('sendInvoiceModal');
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    // [Fix 1] Query invoice_items removed to prevent 400 error
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    // [Fix 3] Query invoice_items instead of items
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
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
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name || '-'}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.qty || 0).toLocaleString()}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
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
                        ${Object.keys(itemInfoMap).map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};

window.viewInvoiceDetail = async function(id) {
    // [Fix 2] Fetch invoice_items and render into popup instead of window.open
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type), invoice_items(name, qty, price, category)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    // [Fix 2] Insert into modal instead of window.open
    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};
window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        console.error("DEBUG viewInvoiceDetail error:", error);
        alert('데이터를 찾을 수 없습니다. 에러: ' + (error ? error.message : '')); 
        return; 
    }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
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
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    // 모달창에 띄울 내용
    let reportHtml = `
        <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
        
        <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        
        <div style="text-align:center; margin-top:30px; font-size: 15px; color: var(--secondary);">
            위 내역으로 거래처 담당자에게 정산명세서를 발송하시겠습니까?<br>
            <span style="font-size:12px; color:#ef4444;">(추후 카카오톡/문자 연동 시 해당 채널로 발송됩니다.)</span>
        </div>
        
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 명세서를 발송 처리하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송 처리가 완료되었습니다.'); // 카카오톡 멘트 제거
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};
window.loadAdminHotelList = async function() {
    const tbody = document.getElementById('adminHotelList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">거래처 목록을 불러오는 중...</td></tr>';

    const { data: hotels, error } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`; return; }
    if(!hotels || hotels.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 거래처가 없습니다.</td></tr>'; return; }

    tbody.innerHTML = '';
    hotels.forEach(h => {
        const badgeClass = h.contract_type === 'fixed' ? 'badge-fixed' : 'badge-unit';
        const badgeText = h.contract_type === 'fixed' ? '정액제' : '단가제';
        tbody.innerHTML += `<tr>
            <td><strong>${h.name}</strong></td>
            <td style="font-size:13px; color:var(--secondary);">${h.ceo || '-'}<br>${h.phone || '-'}</td>
            <td style="font-size:13px; color:var(--secondary);">${h.login_id}<br>****</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <button class="btn-mng btn-info" onclick="openHotelModal('${h.id}')">정보수정</button>
                <button class="btn-mng btn-price" onclick="openPriceSetting('${h.id}')">단가수정</button>
                <button class="btn-mng btn-del" onclick="deleteHotel('${h.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.openHotelModal = async function(hId = null) {
    window.editingHotelIdForInfo = hId;
    editingHotelId = hId; // 동기화
    const modal = document.getElementById('hotelModal'),
          title = modal.querySelector('h3'),
          btn = modal.querySelector('.btn-save');

    // Clear/Reset fields
    ['h_name', 'h_ceo', 'h_phone', 'h_bizNo', 'h_address', 'h_fixedAmount', 'h_loginId', 'h_loginPw'].forEach(f => {
        const el = document.getElementById(f);
        if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
        const err = document.getElementById('err_' + f);
        if(err) err.style.display = 'none';
    });
    document.getElementById('h_contractType').value = 'unit';
    document.getElementById('h_fixedAmountGroup').style.display = 'none';
    const genRadio = document.querySelector('input[name="h_type"][value="general"]');
    if (genRadio) genRadio.checked = true;

    if (hId) {
        title.innerText = '🤝 거래처 정보 수정';
        btn.innerText = '수정 완료';
        const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
        if(h) {
            document.getElementById('h_name').value = h.name;
            document.getElementById('h_ceo').value = h.ceo || '';
            document.getElementById('h_phone').value = h.phone || '';
            document.getElementById('h_bizNo').value = h.biz_no || '';
            document.getElementById('h_address').value = h.address || '';
            document.getElementById('h_contractType').value = h.contract_type;
            document.getElementById('h_fixedAmount').value = h.fixed_amount || '0';
            document.getElementById('h_loginId').value = h.login_id || '';
            document.getElementById('h_loginPw').value = h.login_pw || '';
            if(h.hotel_type) {
                const rb = document.querySelector(`input[name="h_type"][value="${h.hotel_type}"]`);
                if(rb) rb.checked = true;
            }
            if(typeof toggleFixedAmountField === 'function') toggleFixedAmountField();
        }
    } else {
        title.innerText = '🤝 신규 거래처 등록';
        btn.innerText = '거래처 등록';
        
        // 신규 등록 시 공장 기본 단가 불러오기
        window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId).then(({data}) => {
            window.tempDefaultItems = data || [];
        });
    }
    openModal('hotelModal');
};

window.saveNewHotel = async function() {
    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red';
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)';
            if(err) err.style.display = 'none';
        }
    });

    if (!isValid) return;

    // 아이디 중복 체크 로직
    const targetLoginId = document.getElementById('h_loginId').value.trim();
    
    // 수정 시에는 자기 자신을 제외하고 중복 체크
    const query = window.mySupabase.from('hotels').select('id').eq('login_id', targetLoginId);
    if (editingHotelId) {
        query.neq('id', editingHotelId);
    }
    
    const { data: duplicate } = await query.maybeSingle();
    if (duplicate) { alert('이미 사용 중인 거래처 ID입니다. 다른 ID를 입력해주세요.'); return; }

    const payload = {
        factory_id: currentFactoryId,
        hotel_type: document.querySelector('input[name="h_type"]:checked').value,
        name: document.getElementById('h_name').value.trim(),
        ceo: document.getElementById('h_ceo').value.trim(),
        phone: document.getElementById('h_phone').value.trim(),
        biz_no: document.getElementById('h_bizNo').value.trim(),
        address: document.getElementById('h_address').value.trim(),
        contract_type: document.getElementById('h_contractType').value,
        fixed_amount: Number(document.getElementById('h_fixedAmount').value) || 0,
        login_id: document.getElementById('h_loginId').value.trim(),
        login_pw: document.getElementById('h_loginPw').value.trim()
    };

    if(window.editingHotelIdForInfo) {
        await window.mySupabase.from('hotels').update(payload).eq('id', window.editingHotelIdForInfo);
        alert('거래처 정보가 수정되었습니다.');
    } else {
        payload.id = 'h_' + Date.now();
        const { data: insertedHotel } = await window.mySupabase.from('hotels').insert([payload]).select().single();
        
        // [신규 등록 후 기본 단가 자동 적용]
        console.log("DEBUG: tempDefaultItems:", window.tempDefaultItems);
        if (window.tempDefaultItems && window.tempDefaultItems.length > 0 && insertedHotel) {
            console.log("DEBUG: Inserting default prices for hotel:", insertedHotel.id);
            // "기본" 카테고리 확인/생성
            let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', insertedHotel.id).eq('name', '기본').maybeSingle();
            if (!cat) {
                const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: insertedHotel.id, name: '기본' }]).select().single();
                if (res.data) cat = res.data;
            }
            
            if (cat) {
                const inserts = window.tempDefaultItems.map((d, i) => ({
                    factory_id: currentFactoryId,
                    hotel_id: insertedHotel.id,
                    category_id: cat.id,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: d.sort_order || i // [수정] 기본 단가표의 sort_order를 우선 사용하고 없으면 i 사용
                }));
                const { error: insertErr } = await window.mySupabase.from('hotel_item_prices').insert(inserts);
                if (insertErr) console.error("DEBUG: Insert items error:", insertErr);
                else console.log("DEBUG: Default items inserted successfully");
            }
            window.tempDefaultItems = [];
        }
        
        alert('신규 거래처가 등록되었습니다.');
    }
    closeModal('hotelModal');
    window.loadAdminHotelList();
};

window.deleteHotel = async function(hId) {
    if(confirm('정말 이 거래처를 삭제하시겠습니까? 관련된 명세서도 표시되지 않을 수 있습니다.')) {
        await window.mySupabase.from('hotels').delete().eq('id', hId);
        window.loadAdminHotelList();
    }
};

window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId; 
    console.log("DEBUG: openPriceSetting for hotel:", hId, "factory:", currentFactoryId);
    
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id, name, sort_order').eq('hotel_id', hId).limit(10);
    
    // 품목이 0개라면 공장 기본단가에서 복사 (순서대로 가져오기!)
    const { data: defaults } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        // "기본" 카테고리 확인/생성
        let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        if (!cat) {
            const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
            if (res.data) cat = res.data;
        }
        
        if (cat) {
            // 순차적 삽입으로 정렬 순서 보장 (index i 를 사용하여 명확한 순서 부여)
            for (let i = 0; i < defaults.length; i++) {
                const d = defaults[i];
                const insertData = {
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: i, // 사장님의 정렬을 위해 인덱스 i를 강제 할당
                    created_at: new Date(new Date().getTime() + (i * 1000)).toISOString()
                };
                await window.mySupabase.from('hotel_item_prices').insert([insertData]);
            }
        }
    }

    // [중요] 어떤 경우든 목록 새로고침! (단가 복사 여부와 상관없이 호출)
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';
    if (isSpecial) {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        await window.loadHotelCategoryList();
        await window.loadHotelPriceList(); 
        openModal('priceSettingModal');
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        await window.loadSimplePriceList();
        openModal('simplePriceModal');
    }
};

window.loadHotelCategoryList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    if(tagContainer) tagContainer.innerHTML = '';
    if(select) select.innerHTML = '<option value="">선택하세요</option>';
    
    let hasDefault = false;
    
    if(cats && cats.length > 0) {
        cats.forEach(c => {
            if(c.name === '기타') hasDefault = true;
            if(tagContainer) {
                tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} ${c.name !== '기타' ? `<button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>` : ''}
                </span>`;
            }
            if(select) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
    }
    
    // 만약 카테고리가 아예 없거나 기본 '기타' 카테고리가 없다면 추가
    if(!hasDefault) {
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기타' }]);
        const { data: newCats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
        if(newCats) {
            if(tagContainer) tagContainer.innerHTML = '';
            if(select) select.innerHTML = '<option value="">선택하세요</option>';
            newCats.forEach(c => {
                if(tagContainer) {
                    tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                        ${c.name} ${c.name !== '기타' ? `<button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>` : ''}
                    </span>`;
                }
                if(select) select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    }
};

window.addHotelCategory = async function() {
    const input = document.getElementById('new_h_cat_name');
    const catName = input.value.trim();
    if(!catName) return;
    const hId = window.editingHotelIdForPrice;
    
    const { data: exist } = await window.mySupabase.from('hotel_categories').select('id').eq('hotel_id', hId).eq('name', catName).single();
    if(exist) { alert('이미 존재하는 카테고리입니다.'); return; }
    
    await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: catName }]);
    input.value = '';
    await window.loadHotelCategoryList();
};

window.deleteHotelCategory = async function(catId) {
    if(!confirm('삭제하시겠습니까? 이 카테고리에 속한 품목도 모두 함께 삭제됩니다.')) return;
    await window.mySupabase.from('hotel_categories').delete().eq('id', catId);
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
};

window.addHotelCustomItem = async function() {
    // [강제 캐시 갱신] Supabase가 최신 테이블 구조를 인식하게 함 ( category_id, category_name 인식용 )
    await window.mySupabase.from('hotel_item_prices').select('category_id, category_name').limit(1);

    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    
    const selectEl = document.getElementById('hp_cat');
    const catId = selectEl.value;
    
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    if(!catId) { alert('카테고리를 선택해주세요.'); return; }
    
    // [보안] catId로 카테고리 이름을 확실히 조회!
    const { data: catData } = await window.mySupabase.from('hotel_categories').select('name').eq('id', catId).single();
    const finalCatName = catData ? catData.name : '기본';

    const payload = {
        factory_id: String(currentFactoryId),
        hotel_id: String(hId),
        name: String(name),
        price: Number(price),
        unit: String(unit),
        category_id: String(catId),
        category_name: String(finalCatName),
        sort_order: 999
    };
    
    console.log("DEBUG: Final Payload Object:", JSON.stringify(payload));
    
    // [강력 조치] 완전한 insert 시도 후 실패시 업데이트 로직
    const { data: insertData, error: insertError } = await window.mySupabase.from('hotel_item_prices')
        .insert([payload]);

    if (insertError) {
        console.warn("DEBUG: Insert failed, trying update:", insertError.message);
        // insert 실패시 update 시도 (이때는 전체 컬럼 명시)
        const { error: updateError } = await window.mySupabase.from('hotel_item_prices')
            .update({
                price: payload.price,
                unit: payload.unit,
                category_id: payload.category_id,
                category_name: payload.category_name,
                sort_order: payload.sort_order
            })
            .eq('hotel_id', payload.hotel_id)
            .eq('name', payload.name);
            
        if (updateError) {
            console.error("DEBUG: Update failed too:", updateError);
            alert('저장 실패: ' + updateError.message);
            return;
        }
    }
    
    await window.loadHotelPriceList();
    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
    document.getElementById('hp_name').focus();
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: items } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('category_name').order('created_at');
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td>${it.price.toLocaleString()}원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteHotelPrice = async function(itemId) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', itemId);
    await window.loadHotelPriceList();
};
window.loadAdminDefaultPriceList = async function() {
    const tbody = document.getElementById('adminDefaultPriceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기본 품목을 불러오는 중...</td></tr>';

    const { data: items, error } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if(error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">조회 에러: ${error.message}</td></tr>`;
        return;
    }
    console.log("DEBUG: Admin Default Prices:", items);
    console.log("DEBUG: Admin Default Prices Names:", items ? items.map(i => i.name) : 'None');
    console.log("DEBUG: Admin Default Prices SortOrder:", items ? items.map(i => i.sort_order) : 'None');

    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">등록된 기본 품목이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
        tbody.innerHTML += `
        <tr style="height:35px;">
            <td style="padding:4px 8px;"><input type="number" value="${item.sort_order || 0}" style="width:40px;" onchange="updateDefaultPriceOrder('${item.id}', this.value)"></td>
            <td style="padding:4px 8px;">${item.name}</td>
            <td style="padding:4px 8px;">${item.price.toLocaleString()}원</td>
            <td style="padding:4px 8px;">${item.unit}</td>
            <td style="padding:4px 8px;">
                <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice('${item.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.updateDefaultPriceOrder = async function(id, newOrder) {
    console.log("DEBUG: Updating sort_order to:", newOrder, "for ID:", id);
    const { error } = await window.mySupabase.from('factory_default_prices').update({ sort_order: Number(newOrder) || 0 }).eq('id', id);
    if(error) {
        console.error("DEBUG: Update order error:", error);
    }
    await window.loadAdminDefaultPriceList();
};

window.saveDefaultPrice = async function() {
    const nameEl = document.getElementById('dp_name');
    const priceEl = document.getElementById('dp_price');
    const unitEl = document.getElementById('dp_unit');

    const name = nameEl.value.trim();
    const price = Number(priceEl.value) || 0;
    const unit = unitEl.value.trim() || '개';

    if(!name) { alert('품목명을 입력해주세요.'); return; }

    // 기존 품목 개수 확인하여 다음 순서 할당
    const { data: existingItems } = await window.mySupabase.from('factory_default_prices')
        .select('sort_order')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextOrder = existingItems ? (existingItems.sort_order + 1) : 1;

    const payload = {
        factory_id: currentFactoryId,
        name: name,
        price: price,
        unit: unit,
        sort_order: nextOrder
    };

    const { error } = await window.mySupabase.from('factory_default_prices')
        .upsert(payload, { onConflict: 'factory_id, name' });

    if(error) {
        alert('저장에 실패했습니다: ' + error.message);
        return;
    }

    // 입력창 초기화 및 목록 갱신
    nameEl.value = '';
    priceEl.value = '0';
    unitEl.value = '개';
    nameEl.focus();
    
    await window.loadAdminDefaultPriceList();
};

window.deleteDefaultPrice = async function(id) {
    if(!confirm('해당 기본 품목을 삭제하시겠습니까?')) return;

    const { error } = await window.mySupabase.from('factory_default_prices')
        .delete()
        .eq('id', id);

    if(error) {
        alert('삭제에 실패했습니다: ' + error.message);
        return;
    }

    await window.loadAdminDefaultPriceList();
};

window.openDefaultPriceSetting = function() { 
    openModal('defaultPriceModal'); 
    window.loadAdminDefaultPriceList(); 
};
window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId; 
    console.log("DEBUG: openPriceSetting for hotel:", hId, "factory:", currentFactoryId);
    
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id, name, sort_order').eq('hotel_id', hId).limit(10);
    console.log("DEBUG: existItems check:", existItems);
    
    // 품목이 0개라면 공장 기본단가에서 복사 (순서대로 가져오기!)
    const { data: defaults } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    console.log("DEBUG: Condition evaluation:", {
        existItemsEmpty: (!existItems || existItems.length === 0),
        defaultsExist: (defaults && defaults.length > 0),
        combined: ((!existItems || existItems.length === 0) && defaults && defaults.length > 0)
    });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        // "기본" 카테고리 확인/생성
        let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        console.log("DEBUG: Category check:", cat);
        if (!cat) {
            const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
            if (res.data) cat = res.data;
        }
        
        if (cat) {
            // 순차적 삽입으로 정렬 순서 보장 (index i 를 사용하여 명확한 순서 부여)
            for (let i = 0; i < defaults.length; i++) {
                const d = defaults[i];
                console.log("DEBUG: Processing default item:", d.name, "with forced sort_order:", i);
                const insertData = {
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: Number(d.sort_order), // 기본 단가의 순서값을 그대로 사용
                    created_at: new Date(new Date().getTime() + (i * 1000)).toISOString()
                };
                console.log("DEBUG: Inserting item:", d.name, "with DEFAULT sort_order:", d.sort_order);
                const { error: insertErr } = await window.mySupabase.from('hotel_item_prices').insert([insertData]);
                if (insertErr) console.error("DEBUG: Insert failed:", insertErr);
            }
            console.log("DEBUG: Default items inserted sequentially.");
            console.log("DEBUG: Default items inserted sequentially.");
        }
    }

    // [강제 순서 재설정] 데이터가 이미 들어가 있는데 sort_order가 0이면 created_at 순서대로 다시 매긴다
    const { data: items, error } = await window.mySupabase.from('hotel_item_prices')
        .select('*')
        .eq('hotel_id', hId)
        .order('created_at', { ascending: true });
    
    console.log("DEBUG: Checking for reassignment. Items:", items);

    if (items && items.length > 0) {
        console.log("DEBUG: All sort_order are 0:", items.every(i => i.sort_order === 0));
        if (items.every(i => i.sort_order === 0)) {
            console.log("DEBUG: Re-assigning sort_order based on created_at...");
            for (let i = 0; i < items.length; i++) {
                await window.mySupabase.from('hotel_item_prices')
                    .update({ sort_order: i })
                    .eq('id', items[i].id);
            }
            await window.loadSimplePriceList(); // 다시 로드
        }
    }
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    // [수정] select('*')를 명시적인 컬럼 지정으로 변경하여 정확하게 데이터 가져오기!
    const { data: items } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    const tbody = document.getElementById('hotelPriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:80px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.loadSimplePriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    console.log("DEBUG: loadSimplePriceList for hotel:", hId);
    // [수정] select('*')를 명시적인 컬럼 지정으로 변경하여 정확하게 데이터 가져오기!
    const { data: items, error } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, created_at')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    console.log("DEBUG: Final Sorted Items:", items ? items.map(i => ({name: i.name, sort_order: i.sort_order})) : 'None');
    console.log("DEBUG: Hotel Items Info Detail:", JSON.stringify(items.map(i => ({name: i.name, sort_order: i.sort_order}))));
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }

    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    // 일반거래처의 경우 '기본' 카테고리 하나를 자동 부여
    let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
    if (!cat) {
        const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
        if(res.data) cat = res.data;
    }

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit
    };
    
    await window.mySupabase.from('hotel_item_prices').insert([payload]);
    
    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
    await window.loadSimplePriceList();
};

window.deleteSimpleItem = async function(id) {
    if(!confirm('삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', id);
    await window.loadSimplePriceList();
};
