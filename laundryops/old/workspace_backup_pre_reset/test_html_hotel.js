const fs = require('fs');
let html = fs.readFileSync('거래명세서프로그램v35.html', 'utf8');

// Find where hotelDashboard elements are defined
const matches = [
    'hotelMonthlyTotal',
    'hotelMonthlyCount',
    'hotelTopItem',
    'hotelContractInfo',
    'hotelInvoiceList',
    'hotelReceivedInvoicesList'
];

matches.forEach(m => {
    if(html.includes(m)) console.log(`Found: ${m}`);
    else console.log(`MISSING: ${m}`);
});

