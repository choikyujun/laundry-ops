const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

const functionsToPatch = [
    'submitRegistration',
    'saveAndPrintInvoice',
    'saveNewHotel',
    'deleteHotel',
    'saveNewStaff',
    'deleteStaff',
    'saveDefaultPrice',
    'deleteDefaultPrice',
    'approveFactory',
    'rejectFactory',
    'updateFactoryStatus',
    'deleteFactory',
    'saveNewFactory',
    'submitPaymentRequest',
    'confirmSendInvoice',
    'addSimpleItem',
    'addHotelCategory',
    'addHotelCustomItem',
    'deleteHotelPrice',
    'confirmSentReportByPeriod',
    'deleteSentInvoice'
];

functionsToPatch.forEach(fn => {
    // Convert 'window.fnName = function(...) {' to 'window.fnName = async function(...) { await window.fetchFromSupabase();'
    const regex = new RegExp(`window\\.${fn}\\s*=\\s*(async\\s*)?function\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    content = content.replace(regex, (match, p1, p2) => {
        if (p1) {
            // Already async
            return `window.${fn} = async function(${p2}) {\n    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드\n`;
        } else {
            return `window.${fn} = async function(${p2}) {\n    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드\n`;
        }
    });
});

fs.writeFileSync('app.js', content);
console.log("Patched functions with await fetchFromSupabase()");
