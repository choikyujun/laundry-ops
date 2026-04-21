window.updateHotelItemChart = function(stats) {
    try {
        const canvas = document.getElementById('hotelItemPieChart');
        const msg = document.getElementById('hotelNoChartMsg');
        if (!canvas || !msg) return;

        if(Object.keys(stats).length === 0) { 
            canvas.style.display = 'none'; 
            msg.style.display = 'block'; 
            return; 
        }
        canvas.style.display = 'block'; 
        msg.style.display = 'none';
        
        if(window.hotelItemChart) window.hotelItemChart.destroy();
        window.hotelItemChart = new Chart(canvas, { 
            type: 'doughnut', 
            data: { 
                labels: Object.keys(stats), 
                datasets: [{ data: Object.values(stats), backgroundColor: ['#005b9f','#00a8e8','#8b5cf6','#10b981','#f59e0b','#ef4444','#64748b'] }] 
            }, 
            options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } } 
        });
    } catch(e) { console.error("Chart Error:", e); }
};

window.updateHotelTrendChart = function(data) {
    try {
        const canvas = document.getElementById('hotelTrendBarChart');
        if(!canvas) return;
        
        if(window.hotelTrendChart) window.hotelTrendChart.destroy();
        window.hotelTrendChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(data).map(m => m.substring(5) + '월'),
                datasets: [{ label: '월별 매출', data: Object.values(data), backgroundColor: '#005b9f' }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    } catch(e) { console.error("Chart Error:", e); }
};


window.loadHotelDashboard = async function() {
    console.log("DEBUG: loadHotelDashboard called for v35. factory:", currentFactoryId, "hotel:", currentHotelId);
    if (!currentFactoryId) currentFactoryId = localStorage.getItem('currentFactoryId');
    if (!currentHotelId) currentHotelId = localStorage.getItem('currentHotelId');

    console.log("DEBUG: loadHotelDashboard called for v35");
    const { data: fData } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!fData) return;
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', currentHotelId).single();
    if (!hData) return;

    const statsInp = document.getElementById('hotelInvoiceMonth');
    const today = getTodayString();
    const sMonth = statsInp ? (statsInp.value || today.substring(0, 7)) : today.substring(0, 7);
    if(statsInp) statsInp.value = sMonth;

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

    let total = 0;
    let count = 0;
    const itemStats = {};
    const monthlyTrend = {};

    const [y, m] = sMonth.split('-');
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }

    const tbody = document.getElementById('hotelInvoiceList');
    if(tbody) tbody.innerHTML = '';

    const { data: list } = await window.mySupabase.from('invoices')
        .select('id, date, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', currentHotelId)
        .order('date', { ascending: false });

    if(list) {
        list.forEach(inv => {
            const items = inv.invoice_items || [];
            const invSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
            
            if(inv.date.startsWith(sMonth)) {
                total += invSum; 
                count++; 
                items.forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty||0));
                
                if(tbody) {
                    tbody.innerHTML += `<tr>
                        <td>${inv.date}</td>
                        <td style="text-align:right;">${invSum.toLocaleString()}원</td>
                        <td><span class="badge" style="background:var(--success)">입고완료</span></td>
                        <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
                    </tr>`;
                }
            }

            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += invSum;
        });
    }
    
    // 정액제 거래처의 경우 총액 덮어쓰기
    if (hData.contract_type === 'fixed') {
        const fixAmt = Number(hData.fixed_amount || 0);
        total = fixAmt;
        for (const mKey in monthlyTrend) {
            monthlyTrend[mKey] = fixAmt;
        }
    }

    const amountEl = document.getElementById('hotelMonthlyTotal');
    if (amountEl) amountEl.innerText = total.toLocaleString() + "원";
    
    const countEl = document.getElementById('hotelMonthlyCount');
    if (countEl) countEl.innerText = count + "회";
    
    const topEl = document.getElementById('hotelTopItem');
    if (topEl) {
        const top = Object.entries(itemStats).sort((a,b) => b[1]-a[1])[0];
        topEl.innerText = top ? `${top[0]} (${top[1]}개)` : "-";
    }
    
    if(typeof window.updateHotelItemChart === 'function') window.updateHotelItemChart(itemStats);
    if(typeof window.updateHotelTrendChart === 'function') window.updateHotelTrendChart(monthlyTrend);
    if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();
};

window.loadHotelReceivedInvoicesList = async function() {
    try {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신 내역을 불러오는 중...</td></tr>';

        const { data: hData } = await window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount').eq('id', currentHotelId).single();
        if(!hData) return;

        // DB에서 직접 발송된 내역 조회 (hotel_id 기준)
        const { data: list, error: dbErr } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, sent_group_id')
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true)
            .order('date', { ascending: false });

        if (dbErr) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">에러: ' + dbErr.message + '</td></tr>';
            return;
        }

        const groups = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const gId = inv.sent_group_id || (`old_${inv.hotel_id}_${inv.date}`);
                
                if(!groups[gId]) {
                    let period = `${inv.date} ~ ${inv.date}`;
                    if (inv.sent_group_id && inv.sent_group_id.startsWith('g_')) {
                        const parts = inv.sent_group_id.split('_');
                        if (parts.length >= 3) {
                            period = `${parts[1]} ~ ${parts[2]}`;
                        }
                    }
                    groups[gId] = {
                        id: gId,
                        minDate: inv.date,
                        maxDate: inv.date,
                        totalAmount: 0,
                        period: period
                    };
                }
                groups[gId].totalAmount += (inv.total_amount || 0);
                if(inv.date < groups[gId].minDate) groups[gId].minDate = inv.date;
                if(inv.date > groups[gId].maxDate) groups[gId].maxDate = inv.date;
            });
        }
        
        const resultArr = Object.values(groups);
        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        resultArr.forEach(inv => {
            let displayAmount = inv.totalAmount;
            if (hData.contract_type === 'fixed') displayAmount = Number(hData.fixed_amount || 0);
            
            tbody.innerHTML += `<tr>
                <td>${inv.period}</td>
                <td style="text-align:right; font-weight:700;">${Number(displayAmount).toLocaleString()}원</td>
                <td><span class="badge" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px;">정산완료</span></td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:4px;" onclick="viewSentDetail('${hData.name}', '${inv.period}', '${inv.id}', true)">상세</button>
                </td>
            </tr>`;
        });
    } catch(e) {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">에러: ' + e.message + '</td></tr>';
    }
};
