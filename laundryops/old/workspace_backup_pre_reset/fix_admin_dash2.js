const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

// The new window.loadAdminDashboard logic doesn't call window.loadAdminRecentInvoices at the end due to a missing function call.
// Wait, let's see how the last window.loadAdminDashboard is defined.
const lines = app.split('\n');
const startIdx = lines.findIndex(l => l.startsWith('window.loadAdminDashboard = async function() {'));
console.log(lines.slice(startIdx, startIdx+30).join('\n'));
