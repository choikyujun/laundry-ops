const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I completely stripped `let _isInvoiceLoading = false;` when I was removing redundant code blocks!
// Let's add it to the top.
code = `let _isInvoiceLoading = false;\n` + code;

fs.writeFileSync('app_v38.js', code);
