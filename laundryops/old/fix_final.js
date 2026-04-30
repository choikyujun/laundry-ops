const fs = require('fs');
let code = fs.readFileSync('app_v38_clean.js', 'utf-8');
code = code.replace(/\.not\('staff_name', 'like', '관리자\(차감\)%'\);/g, ";");

// Save back to app_v38.js
fs.writeFileSync('app_v38.js', code);
