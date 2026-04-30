const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// The user says "세탁공장대표 화면에 데이터가 안보여."
// Is `adminRecentInvoiceList` empty?
// Wait, `loadAdminRecentInvoices` was rewritten without `window.loadAdminRecentInvoices_OLD`.
// Did we break the DOM injection? Let's check `loadAdminRecentInvoices` in app_v38.js.
console.log(code.match(/window\.loadAdminRecentInvoices = async function[\s\S]*?filteredData\.forEach\(inv => \{[\s\S]*?\}\);/)[0]);

