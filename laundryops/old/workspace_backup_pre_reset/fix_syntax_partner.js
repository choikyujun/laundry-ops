const fs = require('fs');
let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// fix double declaration
code = code.replace(/let resultArr = Object.values\(dbGrouped\);/, 'resultArr = Object.values(dbGrouped);');

fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Syntax fixed.");
