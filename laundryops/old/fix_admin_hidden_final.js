const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// 1. We must replace ALL `.neq('staff_name', '관리자(차감)')` with frontend filter.
// Wait, in my previous attempt, it only replaced `.not('staff_name', 'like')`.
// In app_v38.js at line 4910: `.neq('staff_name', '관리자(차감)')`
code = code.replace(/\.neq\('staff_name',\s*'관리자\(차감\)'\)/g, "");

// Then add the frontend filter where it says `if (!data || data.length === 0)`
code = code.replace(/if \(\!data \|\| data\.length === 0\) \{\n\s*tbody\.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다\.<\/td><\/tr>';/g, `
        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
`);

code = code.replace(/tbody\.innerHTML = '';\n\s*data\.forEach\(inv => \{/g, `tbody.innerHTML = '';
        filteredData.forEach(inv => {`);

fs.writeFileSync('app_v38.js', code);
