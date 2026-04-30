const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// There is a piece of code that was left outside a function (the old loadSuperAdminDashboard body).
// We'll replace it with a clean slate for that section.
const regex = /\/\* removed dup \*\/[\s\S]*?(?=window\.loadPendingFactories\s*=\s*function)/m;
app = app.replace(regex, '/* cleaned up old super admin code */\n');

fs.writeFileSync('app_v34.js', app);
console.log('Syntax error fixed');
