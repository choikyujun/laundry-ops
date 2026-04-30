const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// remove all duplicate window.loadAdminDashboard except the very last one
const parts = app.split('window.loadAdminDashboard = ');

// keep parts[0] (before the first def) + the very last function body which contains the actual logic
// Wait, the v34 logic uses DB directly now. 
const dbDashboardBody = `async function() {
    console.log("DEBUG: loadAdminDashboard DB version started");

    const statsMonth = document.getElementById('adminStatsMonth');
    if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);
    const curMonth = statsMonth ? statsMonth.value : getTodayString().substring(0, 7);

    // 1. 공장 정보 및 요금제/구독 상태 로드
    const { data: f, error: fErr } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (fErr || !f) return;

    // 구독 배너 그리기
    const subStatusLeft = document.getElementById('subStatusLeft');
    const subPlanRight = document.getElementById('subPlanRight');
    const subBanner = document.getElementById('subBanner');
    
    if (subStatusLeft && subPlanRight && subBanner) {
        const subLabel = f.sub_status === 'expired' ? '만료됨' : (f.sub_status === 'expiring' ? '만료임박' : '활성(사용중)');
        subStatusLeft.innerHTML = \`구독상태: \${subLabel}\`;
        subPlanRight.innerHTML = \`요금제: \${f.plan || '라이트'} &nbsp;|&nbsp; 만료일: \${f.plan_expiry || '제한없음'}\`;
        
        if (f.sub_status === 'expired') subBanner.style.background = '#fee2e2'; 
        else if (f.sub_status === 'expiring') subBanner.style.background = '#fef3c7'; 
        else subBanner.style.background = '#e0f2fe';
    }

    // 2. 매출 요약(4개 카드) 계산
    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    const todayStr = getTodayString();
    const [y, m] = curMonth.split('-');
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = prevDate.toISOString().substring(0, 7);

    // 단가제 매출 
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) monthRev += inv.total_amount;
            if(inv.date.startsWith(prevMonth)) prevMonthRev += inv.total_amount;
        });
    }

    // 정액제 매출 합산
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

    // 3. 거래명세서 목록 강제 로드!
    if(typeof window.loadAdminRecentInvoices === 'function') {
        await window.loadAdminRecentInvoices();
    }
};
`;

app = app.replace(/window\.loadAdminDashboard\s*=\s*function\(\)\s*\{[\s\S]*?(?=function getTodayString)/m, '/* removed old JSON dashboard */\n');
app = app.replace(/window\.loadAdminDashboard\s*=\s*async function\(\)\s*\{[\s\S]*?(?=window\.loadAdminRecentInvoices\s*=)/m, '/* removed dummy */\n');
app += `\nwindow.loadAdminDashboard = ${dbDashboardBody}`;

fs.writeFileSync('app_v34.js', app);
console.log('Admin Dashboard rewritten to DB');
