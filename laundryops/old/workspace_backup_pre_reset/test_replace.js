const fs = require('fs');

let file1 = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');
file1 = file1.replace(/공급가\(합계\): ₩ \$\{supplyPrice.toLocaleString\(\)\}/g, 
    '공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ ${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}');
fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', file1);

let file2 = fs.readFileSync('patch_view_detail.js', 'utf8');
// patch_view_detail.js is already doing supplyPrice, vat, totalAmount correctly. Let's make sure it's used for adminSentList and partnerView.
console.log('Done');
