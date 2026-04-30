const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to ensure that `window._lastInvoiceData = filteredData;` is assigned.
// Wait, `filteredData` was defined as `const filteredData = data ? data.filter...`
// Let's add `window._lastInvoiceData = filteredData;` where needed.
const targetLine = "        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];";
const replaceLine = "        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];\n        window._lastInvoiceData = filteredData;";

code = code.replace(targetLine, replaceLine);

fs.writeFileSync('app_v38.js', code);
