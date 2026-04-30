const fs = require('fs');
let code = fs.readFileSync('patch_v35_final_v3.js', 'utf8');

// remove the prepended garbage
code = code.replace(/const staffName = \(typeof currentStaffName !== 'undefined' && currentStaffName\) \? currentStaffName : \(window\.currentStaffName \|\| localStorage\.getItem\('staffName'\) \|\| localStorage\.getItem\('currentStaffName'\) \|\| '직원'\);\/\//, '//');

// fix the actual line
code = code.replace(/const staffName = window\.currentStaffName \|\| localStorage\.getItem\('staffName'\) \|\| '직원';/, 
    "const staffName = (typeof currentStaffName !== 'undefined' && currentStaffName) ? currentStaffName : (window.currentStaffName || localStorage.getItem('currentStaffName') || localStorage.getItem('staffName') || '직원');");

fs.writeFileSync('patch_v35_final_v3.js', code);
