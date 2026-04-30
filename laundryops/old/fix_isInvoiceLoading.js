const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I forgot to declare `let _isInvoiceLoading = false;` globally!
// Or rather, the previous functions use `_isInvoiceLoading` but since I removed it, it throws `ReferenceError`?
// Let's check `node -c app_v38.js`.
