const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// The issue! `window.addEventListener('DOMContentLoaded', initApp);`
// But `initApp` is defined as `window.initApp` !
// So `initApp` variable is not found in the global scope of JS module (if strict or let context).
// It should be `window.initApp`.

code = code.replace(/window\.addEventListener\('DOMContentLoaded', initApp\);/g, "window.addEventListener('DOMContentLoaded', window.initApp);");

fs.writeFileSync('app_v38.js', code);
