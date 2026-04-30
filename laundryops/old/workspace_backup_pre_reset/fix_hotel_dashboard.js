
window.loadHotelDashboard = async function() {
    console.log("DEBUG: loadHotelDashboard (SQL-First) 시작");
    if (!currentFactoryId) currentFactoryId = localStorage.getItem('currentFactoryId');
    if (!currentHotelId) currentHotelId = localStorage.getItem('currentHotelId');

    // 1. 공장 및 거래처 정보 가져오기
    const { data: fData } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', currentHotelId).single();
    if (!fData || !hData) return;

    // UI 업데이트 (기본 정보)
    const hTitle = document.getElementById('hotelNameTitle');
    if (hTitle) hTitle.innerText = hData.name;
    const hPhone = document.getElementById('h_factoryPhone');
    if (hPhone) hPhone.innerText = fData.phone || '-';
    const hCeo = document.getElementById('h_factoryCeo');
    if (hCeo) hCeo.innerText = fData.ceo || '-';

    // 계약 정보 표시
    const contractEl = document.getElementById('hotelContractInfo');
    if(contractEl) {
        const contractText = hData.contract_type === 'fixed' ? `정액제 (월 ${Number(hData.fixed_amount || 0).toLocaleString()}원)` : '단가제';
        contractEl.innerText = contractText;
    }

    const statsInp = document.getElementById('hotelInvoiceMonth');
    const sMonth = statsInp ? (statsInp.value || new Date().toISOString().substring(0, 7)) : new Date().toISOString().substring(0, 7);
    if(statsInp) statsInp.value = sMonth;

    // 2. 명세서 데이터 가져오기 (SQL)
    const { data: list } = await window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', currentHotelId)
        .gte('date', sMonth + '-01')
        .lte('date', sMonth + '-31')
        .order('date', { ascending: false });

    // 3. 통계 계산
    let total = 0;
    let count = 0;
    const itemStats = {};
    const monthlyTrend = {};

    // 월별 추이 초기화 (최근 6개월)
    for(let i=0; i<6; i++) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        monthlyTrend[d.toISOString().substring(0, 7)] = 0;
    }

    const tbody = document.getElementById('hotelInvoiceList');
    if(tbody) tbody.innerHTML = '';

    (list || []).forEach(inv => {
        const invSum = Number(inv.total_amount || 0);
        total += invSum;
        count++;
        
        (inv.invoice_items || []).forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty || 0));

        if(tbody) {
            tbody.innerHTML += `<tr>
                <td>${inv.date}</td>
                <td style="text-align:right;">${invSum.toLocaleString()}원</td>
                <td><span class="badge" style="background:var(--success)">입고완료</span></td>
                <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
            </tr>`;
        }
        
        const mKey = inv.date.substring(0, 7);
        if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += invSum;
    });

    if(tbody && tbody.innerHTML === '') tbody.innerHTML = `<tr><td colspan="4" style="padding:30px; color:gray;">${sMonth} 내역 없음</td></tr>`;

    // 정액제 대응
    if (hData.contract_type === 'fixed') {
        total = Number(hData.fixed_amount || 0);
        Object.keys(monthlyTrend).forEach(k => monthlyTrend[k] = total);
    }

    // 통계 표시
    document.getElementById('hotelMonthlyTotal').innerText = total.toLocaleString() + "원";
    document.getElementById('hotelMonthlyCount').innerText = count + "회";
    
    const topItem = Object.entries(itemStats).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('hotelTopItem').innerText = topItem ? `${topItem[0]} (${topItem[1]}개)` : "-";
    
    window.updateHotelItemChart(itemStats);
    window.updateHotelTrendChart(monthlyTrend);
    window.loadHotelReceivedInvoicesList();
};

window.loadHotelReceivedInvoicesList = async function() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신 내역 불러오는 중...</td></tr>';

    const { data: logs, error } = await window.mySupabase.from('sent_logs')
        .select('period, total_amount, sent_at')
        .eq('hotel_id', currentHotelId)
        .order('sent_at', { ascending: false });

    if(error || !logs) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">오류 발생</td></tr>'; return; }
    if(logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>'; return; }

    tbody.innerHTML = '';
    logs.forEach(log => {
        tbody.innerHTML += `<tr>
            <td>${log.period}</td>
            <td style="text-align:right;">${log.total_amount.toLocaleString()}원</td>
            <td><span class="badge" style="background:var(--success)">정산완료</span></td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="alert('상세보기 준비중')">상세</button></td>
        </tr>`;
    });
};
