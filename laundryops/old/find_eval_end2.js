const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I notice `window.OLD_loadAdminStaffList_0` is defined around line 1821.
// And `window.loadAdminStaffList` is defined at line 6775. Wait! If `window.loadAdminStaffList` is defined way down there, it means the script DID execute that far!
// But why aren't functions like `window.login` showing up in `Object.keys(window)`?
// Because `window.login` is at line 3125!

// Let's check what line the last key on window is defined.
const lines = code.split('\n');
console.log("window.login line:", lines.findIndex(l => l.includes('window.login =')) + 1);
console.log("window.loadAdminStaffList line:", lines.findIndex(l => l.includes('window.loadAdminStaffList =')) + 1);
console.log("window.loadAdminRecentInvoices line:", lines.findIndex(l => l.includes('window.loadAdminRecentInvoices =')) + 1);
