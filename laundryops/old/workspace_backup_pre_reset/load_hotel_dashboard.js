window.loadHotelDashboard = function() {
    const f = platformData.factories[currentFactoryId];
    if (!f) return;
    const h = f.hotels[currentHotelId];
    if (!h) return;

    // 호텔 파트너 화면용 월 선택기 사용
    const statsInp = document.getElementById('hotelInvoiceMonth');
    const today = getTodayString(), sMonth = statsInp ? (statsInp.value || today.substring(0, 7)) : today.substring(0, 7);
    if(statsInp) statsInp.value = sMonth;

    const hTitle = document.getElementById('hotelNameTitle');
    if (hTitle) hTitle.innerText = h.name;
    
    const hPhone = document.getElementById('h_factoryPhone');
    if (hPhone) hPhone.innerText = f.phone || '-';
    
    const hCeo = document.getElementById('h_factoryCeo');
    if (hCeo) hCeo.innerText = f.ceo || '-';

    // 계약 정보 표시
    const contractEl = document.getElementById('hotelContractInfo');
    if(contractEl) {
        const contractText = h.contractType === 'fixed' ? `정액제 (월 ${Number(h.fixedAmount).toLocaleString()}원)` : '단가제';
        contractEl.innerText = contractText;
    }

    window.loadHotelReceivedInvoicesList();

    const tbody = document.getElementById('hotelInvoiceList'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    let total = 0, count = 0; const itemStats = {}; const monthlyTrend = {};
    const baseDate = new Date(sMonth + "-01");
    for(let i=5; i>=0; i--) { const d = new Date(baseDate); d.setMonth(d.getMonth() - i); monthlyTrend[d.toISOString().substring(0, 7)] = 0; }

    (f.history || []).filter(inv => inv.hotelId === currentHotelId).forEach(inv => {
        const invSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
        if(inv.date.startsWith(sMonth)) {
            total += invSum; count++; inv.items.forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + it.qty);
            tbody.innerHTML += `<tr><td>${inv.date}</td><td style="text-align:center;">${invSum.toLocaleString()}원</td><td><span class="badge" style="background:var(--success)">입고완료</span></td><td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td></tr>`;
        }
        const m = inv.date.substring(0, 7);
        if(monthlyTrend[m] !== undefined) monthlyTrend[m] += invSum;
    });

    if(tbody.innerHTML === '') tbody.innerHTML = `<tr><td colspan="4" style="padding:30px; color:gray;">${sMonth} 내역 없음</td></tr>`;

    const totalEl = document.getElementById('hotelMonthlyTotal');
    if (totalEl) totalEl.innerText = total.toLocaleString() + "원";
    
    const countEl = document.getElementById('hotelMonthlyCount');
    if (countEl) countEl.innerText = count + "회";
    
    const topEl = document.getElementById('hotelTopItem');
    if (topEl) {
        const top = Object.entries(itemStats).sort((a,b) => b[1]-a[1])[0];
        topEl.innerText = top ? `${top[0]} (${top[1]}개)` : "-";
    }

    updateHotelItemChart(itemStats);
    updateHotelTrendChart(monthlyTrend);
};

window.updateHotelItemChart = function(stats) {
    const canvas = document.getElementById('hotelItemPieChart');
    const msg = document.getElementById('hotelNoChartMsg');
    if (!canvas || !msg) return; // 요소가 없으면 에러 없이 종료

    if(Object.keys(stats).length === 0) { canvas.style.display = 'none'; msg.style.display = 'block'; return; }
    canvas.style.display = 'block'; msg.style.display = 'none';
    if(hotelItemChart) hotelItemChart.destroy();
    hotelItemChart = new Chart(canvas, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#005b9f','#00a8e8','#8b5cf6','#10b981','#f59e0b','#ef4444','#64748b'] }] }, options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } } });
};

window.loadHotelReceivedInvoicesList = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f || !f.sentInvoices) return;
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 현재 호텔 ID와 일치하는 발송 내역 필터링
    const myInvoices = f.sentInvoices.filter(inv => inv.hotelId === currentHotelId);

    myInvoices.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)).forEach(inv => {
        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
            <td>${inv.totalAmount.toLocaleString()}원</td>
            <td><span class="badge" style="background:var(--success)">수신완료</span></td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${f.hotels[currentHotelId].name}', '${inv.period}', '${inv.sentAt}', true)">상세</button></td>
        </tr>`;
    });
};

window.updateHotelTrendChart = function(data) {
    const canvas = document.getElementById('hotelTrendBarChart');
    if(!canvas) return;
    if(hotelTrendChart) hotelTrendChart.destroy();
    hotelTrendChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Object.keys(data).map(m => m.substring(5) + '월'),
            datasets: [{ label: '월별 매출', data: Object.values(data), backgroundColor: '#005b9f' }]
