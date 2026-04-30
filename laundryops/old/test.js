const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
let targetStr = "let isMonthlyDeduction = inv.staff_name && inv.staff_name.startsWith('관리자(차감)') || it.name.includes('(차감)') || it.name.includes('(클레임차감)');";
let newStr = "let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');";
code = code.replace(targetStr, newStr);
fs.writeFileSync('app_v38.js', code);
