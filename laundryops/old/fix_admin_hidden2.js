const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// 1. Backend filter
code = code.replace(/\.neq\('staff_name',\s*'관리자\(차감\)'\)/g, ".not('staff_name', 'like', '관리자(차감)%')");

// 2. Frontend logic (viewSentDetail etc)
code = code.replace(/inv\.staff_name === '관리자\(차감\)'/g, "(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");
code = code.replace(/inv\.staff_name !== '관리자\(차감\)'/g, "!(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");

fs.writeFileSync('app_v38.js', code);
