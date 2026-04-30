const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// Fix loadAdminRecentInvoices
code = code.replace(
    /\.not\('staff_name',\s*'like',\s*'관리자\(차감\)%'\);/g,
    ";"
);

// We need to add frontend filter to data
code = code.replace(
    /const { data, error } = await query\.order\('date', { ascending: false }\)\.limit\((100|\d+)\);[\s\S]*?if \(!data \|\| data\.length === 0\) {/g,
    (match) => {
        return match.replace(
            `if (!data || data.length === 0) {`,
            `const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];\n    if (filteredData.length === 0) {`
        );
    }
);

code = code.replace(
    /data\.forEach\(inv => {/g,
    (match, offset) => {
        // check if we are inside loadAdminRecentInvoices
        const before = code.substring(Math.max(0, offset - 300), offset);
        if (before.includes('adminRecentInvoiceList') || before.includes('filteredData')) {
            return `filteredData.forEach(inv => {`;
        }
        return match;
    }
);

fs.writeFileSync('app_v38.js', code);
