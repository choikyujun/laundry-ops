const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
code = code.replace(/window\.addEventListener\('DOMContentLoaded', initApp\);/g, "window.addEventListener('DOMContentLoaded', window.initApp);");
fs.writeFileSync('app_v38.js', code);
