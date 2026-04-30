const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// Fix getTodayString
app += `
window.getTodayString = function() {
    const d = new Date(); 
    d.setHours(d.getHours() + 9); // KST
    return d.toISOString().split('T')[0];
};

window.calculateAdminDashStats = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    // YYYY-MM
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    console.log("DEBUG: Dash Stats -> Today:", todayStr, "CurMonth:", curMonth, "PrevMonth:", prevMonthStr);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) monthRev += inv.total_amount;
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += inv.total_amount;
        });
    }

    const { data: hotelData } = await window.mySupabase.from('hotels').select('contract_type, fixed_amount').eq('factory_id', currentFactoryId);
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

    document.getElementById('adminTodayRevenue').innerText = todayRev.toLocaleString() + '원';
    document.getElementById('adminMonthlyRevenue').innerText = monthRev.toLocaleString() + '원';
    
    let growth = 0;
    if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    document.getElementById('adminGrowthRate').innerText = growth.toFixed(1) + '%';
    
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    document.getElementById('adminSummaryCount').innerText = activeHotels + ' / ' + (staffCount || 0);
};

// hook it to loadAdminDashboard
const _dbDashHook2 = window.loadAdminDashboard;
window.loadAdminDashboard = async function() {
    await _dbDashHook2();
    await window.calculateAdminDashStats();
};
`;

fs.writeFileSync('app_v34.js', app);
console.log('Date and Stat logic fixed');
