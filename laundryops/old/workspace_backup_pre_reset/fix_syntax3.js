const fs = require('fs');
let app = fs.readFileSync('app_v34.js', 'utf8');

// The regex replace accidentally left `window.loadAdminRecentInvoices === 'function') { await window.loadAdminRecentInvoices(); } };` floating outside.
app = app.replace(/window\.loadAdminRecentInvoices === 'function'\) \{\s*await window\.loadAdminRecentInvoices\(\);\s*\}\s*\};\s*/, '');

fs.writeFileSync('app_v34.js', app);
console.log('Floating curly braces fixed.');
