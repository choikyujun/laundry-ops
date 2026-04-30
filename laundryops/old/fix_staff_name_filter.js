const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// The `if (inv.staff_name === '관리자(차감)') return;` is incorrect because now the staff_name is `관리자(차감)_<id>`.
// So it should be `if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;`

code = code.replace(/if \(inv\.staff_name === '관리자\(차감\)'\) return;/g, "if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;");

fs.writeFileSync('app_v38.js', code);
