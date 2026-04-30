const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

app = app.replace(/window\.loadAdminRecentInvoices\s*=\s*async function\(returnList\s*=\s*false\)\s*\{[\s\S]*?(?=window\.loadAdminDashboard = function\(\)|window\.loadAdminDashboard = async function\(\))/gm, '/* removed dup */\n');

fs.writeFileSync('app_v34.js', app);
console.log('Duplicates removed');
