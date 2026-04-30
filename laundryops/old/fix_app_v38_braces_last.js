const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
// remove the last `}` at the end of the file.
code = code.replace(/\n\}$/g, '');
fs.writeFileSync('app_v38.js', code);
