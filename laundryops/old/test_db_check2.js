const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

console.log("Is _currentDeductions there?", code.includes('_currentDeductions'));
console.log("Is sendInvoicesToClient there?", code.includes('window.sendInvoicesToClient ='));
console.log("Does it skip 관리자(차감)?", code.includes("if (inv.staff_name === '관리자(차감)') return;"));
