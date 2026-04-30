const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

app += `
window.calculateAdminDashStats = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    console.log("DEBUG: [v34 Stats] -> Today:", todayStr, "CurMonth:", curMonth, "PrevMonth:", prevMonthStr);
    
    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    
    const { data: invData, error: errInv } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    console.log("DEBUG: [v34 Stats Invoices] ->", invData, errInv);
    
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) monthRev += inv.total_amount;
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += inv.total_amount;
        });
    }

    const { data: hotelData, error: errHtl } = await window.mySupabase.from('hotels').select('contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    console.log("DEBUG: [v34 Stats Hotels] ->", hotelData, errHtl);
    
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                monthRev += Number(h.fixed_amount || 0);
                prevMonthRev += Number(h.fixed_amount || 0);
            }
        });
    }

    console.log("DEBUG: [v34 Stats Result] -> TodayRev:", todayRev, "MonthRev:", monthRev, "ActiveHotels:", activeHotels);

    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    let growth = 0;
    if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) el3.innerText = growth.toFixed(1) + '%';
    
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) el4.innerText = activeHotels + ' / ' + (staffCount || 0);
};
`;

fs.writeFileSync('app_v34.js', app);
console.log('Appended debugs to stats function');
