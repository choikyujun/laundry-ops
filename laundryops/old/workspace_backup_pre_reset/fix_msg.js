const fs = require('fs');

let content = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// Replace confirm message
const oldMsg = "if(confirm(`${report.hName} 거래처로 ${report.list.length}건의 명세서를 발송하시겠습니까?`)) {";
const newMsg = "if(confirm(`${report.hName} 거래처로 월정산 명세서를 발송하시겠습니까?`)) {";

content = content.replace(oldMsg, newMsg);

fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', content);
console.log("Confirm message changed.");
