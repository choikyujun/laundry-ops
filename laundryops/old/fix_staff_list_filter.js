const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

code = code.replace(
    /const filteredData = data\.filter\(inv => inv\.staff_name !== '관리자\(차감\)'\);/g,
    "const filteredData = data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));"
);

fs.writeFileSync('app_v38.js', code);
