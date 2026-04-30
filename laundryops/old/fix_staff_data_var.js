const fs = require('fs');

// Ah! `let _staffInvoiceAllData = [];` is defined at L2730.
// But L2770 assigns to `window._staffInvoiceAllData = filteredData;` !!
// And then L2786 uses `_staffInvoiceAllData.length` (without window) !
// Since `_staffInvoiceAllData` is a `let` variable, assigning to `window._staffInvoiceAllData` DOES NOT update the local `let` variable.
// So `_staffInvoiceAllData.length` remains 0 (the initial empty array), and the list shows nothing!

let code = fs.readFileSync('app_v38.js', 'utf-8');

code = code.replace(
    /window\._staffInvoiceAllData = filteredData;\n\s*window\._staffInvoicePage = 1;/g,
    `_staffInvoiceAllData = filteredData;\n    _staffInvoicePage = 1;`
);

fs.writeFileSync('app_v38.js', code);
