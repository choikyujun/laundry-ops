const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I completely missed `if (returnList) return filteredData;`
code = code.replace(
    /        _isInvoiceLoading = false;\n    }\n\};\n\nwindow\.exportInvoicesToPDF = async function\(\) \{/g,
    `        _isInvoiceLoading = false;\n    }\n    if (returnList) return window._lastInvoiceData;\n};\n\nwindow.exportInvoicesToPDF = async function() {`
);

code = code.replace(
    /const filteredData = data \? data\.filter\(inv => \!\(inv\.staff_name && inv\.staff_name\.startsWith\('관리자\(차감\)'\)\)\) \: \[\];/g,
    `const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];\n        window._lastInvoiceData = filteredData;`
);

fs.writeFileSync('app_v38.js', code);
