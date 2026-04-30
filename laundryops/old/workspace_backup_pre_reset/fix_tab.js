const fs = require('fs');
let app = fs.readFileSync('app_v34.js', 'utf8');

// remove all duplicate window.loadAdminRecentInvoices definition except the DB-connected one.
app = app.replace(/window\.loadAdminRecentInvoices\s*=\s*function\(returnList\s*=\s*false\)\s*\{[\s\S]*?(?=window\.changeAdminSentPage)/m, '/* replaced */');

fs.writeFileSync('app_v34.js', app);
console.log("Duplicate function removed.");
