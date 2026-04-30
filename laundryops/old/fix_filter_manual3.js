const fs = require('fs');

let code = fs.readFileSync('app_v38_clean.js', 'utf-8');

// 1. In loadAdminRecentInvoices
let regexAdminList = /let query = window\.mySupabase[\s\S]*?\.eq\('factory_id', currentFactoryId\)\s*\n\s*\.not\('staff_name', 'like', '관리자\(차감\)%'\);/;
code = code.replace(regexAdminList, `let query = window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);`);

code = code.replace(
    /const { data, error } = await query\.order\('date', { ascending: false }\)\.limit\(100\);\n\n\s*if \(error\) {[\s\S]*?return;\n\s*}\n\n\s*if \(!data \|\| data\.length === 0\) {/g,
    `const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color:red;">에러: \${error.message}</td></tr>\`;
            _isInvoiceLoading = false;
            return;
        }

        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if (filteredData.length === 0) {`
);

code = code.replace(/tbody\.innerHTML = '';\n\s*data\.forEach\(inv => {/g, `tbody.innerHTML = '';
        filteredData.forEach(inv => {`);

// 2. In loadAdminStaffList
let regexAdminStaffList = /const { data: invoices, error: iErr, count } = await window\.mySupabase\.from\('invoices'\)\s*\n\s*\.select\('\*, hotels\(name\)', { count: 'exact' }\)\s*\n\s*\.eq\('factory_id', currentFactoryId\)\s*\n\s*\.not\('staff_name', 'like', '관리자\(차감\)%'\)/;
code = code.replace(regexAdminStaffList, `const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)`);

code = code.replace(
    /else if\(!invoices \|\| invoices\.length === 0\) \{ activityBody\.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다\.<\/td><\/tr>'; \}\n\s*else \{\n\s*activityBody\.innerHTML = '';\n\s*invoices\.forEach\(inv => \{/g,
    `else {
        const filteredInvoices = invoices ? invoices.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if(filteredInvoices.length === 0) {
            activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>';
        } else {
            activityBody.innerHTML = '';
            filteredInvoices.forEach(inv => {`
);

fs.writeFileSync('app_v38_clean.js', code);
