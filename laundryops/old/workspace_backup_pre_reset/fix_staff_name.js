const fs = require('fs');
let code = fs.readFileSync('patch_v35_final_v3.js', 'utf8');
code = code.replace(/const staffName = window\.currentStaffName || localStorage\.getItem\('staffName'\) || '직원';/, "const staffName = typeof currentStaffName !== 'undefined' ? currentStaffName : (window.currentStaffName || localStorage.getItem('staffName') || '직원');");
fs.writeFileSync('patch_v35_final_v3.js', code);
console.log('Fixed staffName variable scope issue');
