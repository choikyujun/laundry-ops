const fs = require('fs');

fs.copyFileSync('backup/v38_final/app_v38.js', 'app_v38.js');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// 1. Backend filter (for loadAdminStaffList etc where we used .not instead of .neq)
code = code.replace(/\.neq\('staff_name',\s*'관리자\(차감\)'\)/g, ".not('staff_name', 'like', '관리자(차감)%')");

// 2. Frontend logic (viewSentDetail etc)
code = code.replace(/inv\.staff_name === '관리자\(차감\)'/g, "(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");
code = code.replace(/inv\.staff_name !== '관리자\(차감\)'/g, "!(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");

fs.writeFileSync('app_v38.js', code);

// 3. Make login completely global in HTML directly
let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');
html = html.replace(/onclick="login\(\)"/g, 'onclick="window.login()"');
html = html.replace(/onkeydown="if\(event\.key==='Enter'\) login\(\)"/g, 'onkeydown="if(event.key===\'Enter\') window.login()"');
fs.writeFileSync('거래명세서프로그램v38.html', html);
