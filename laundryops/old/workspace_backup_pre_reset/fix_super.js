const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// remove old window.loadSuperAdminDashboard
app = app.replace(/window\.loadSuperAdminDashboard\s*=\s*function\(\)\s*\{[\s\S]*?(?=window\.loadPendingFactories)/m, '/* removed dup */\n');

fs.writeFileSync('app_v34.js', app);
console.log('Old loadSuperAdminDashboard removed');
