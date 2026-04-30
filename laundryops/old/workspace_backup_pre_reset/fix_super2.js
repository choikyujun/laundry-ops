const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// The output shows dashboard_functions.js is still running its old loadSuperAdminDashboard and overriding app_v34.js
// We need to nullify the functions in dashboard_functions.js or just change the HTML to not load it.
let html = fs.readFileSync('거래명세서프로그램v34.html', 'utf8');

html = html.replace('<script src="dashboard_functions.js"></script>', '<!-- dashboard_functions.js removed for v34 -->');
fs.writeFileSync('거래명세서프로그램v34.html', html);
console.log('Removed dashboard_functions.js from HTML');
