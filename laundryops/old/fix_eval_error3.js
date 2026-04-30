const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
code = code.replace(/URL\.revokeObjectURL\(url\);\n\};\n\n\}/g, "URL.revokeObjectURL(url);\n};\n");
fs.writeFileSync('app_v38.js', code);
