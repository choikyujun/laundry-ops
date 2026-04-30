const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to filter out '관리자(차감)' from the hotel dashboard `invList`.
// Wait, the select query is `.select('id, date, total_amount')`. It DOES NOT select `staff_name`!
// So I must add `staff_name` to the select, then filter.

const regexStats = /const \{ data: invList \} = await window\.mySupabase\s*\n\s*\.from\('invoices'\)\s*\n\s*\.select\('id, date, total_amount'\)\s*\n\s*\.eq\('hotel_id', currentHotelId\)/;

const replaceStats = `const { data: invListRaw } = await window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, staff_name')
        .eq('hotel_id', currentHotelId)`;

code = code.replace(regexStats, replaceStats);

// Then filter: `const invList = (invListRaw || []).filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));`

code = code.replace(
    /\.lte\('date', sMonthEnd\)\s*\n\s*\.order\('date', \{ ascending: false \}\);\n\n\s*\/\/ 목록 렌더링 \+ 통계 집계\n\s*const tbody = el\('hotelInvoiceList'\);\n\s*if \(tbody\) tbody\.innerHTML = '';\n\s*let total = 0, count = 0;\n\n\s*\(invList \|\| \[\]\)\.forEach\(inv => \{/g,
    `.lte('date', sMonthEnd)
        .order('date', { ascending: false });

    // [수정] 관리자(차감) 명세서는 파트너(거래처)의 최근 입고 현황에서 투명인간 처리!
    const invList = (invListRaw || []).filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));

    // 목록 렌더링 + 통계 집계
    const tbody = el('hotelInvoiceList');
    if (tbody) tbody.innerHTML = '';
    let total = 0, count = 0;

    invList.forEach(inv => {`
);

fs.writeFileSync('app_v38.js', code);
