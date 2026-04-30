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

    // [v35] 매출 TOP 10 업데이트
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
