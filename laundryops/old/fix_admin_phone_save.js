const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

code = code.replace(
    /if \(phone\) payload\.admin_phone = phone;/g,
    'payload.admin_phone = phone;'
);

fs.writeFileSync('app_v38.js', code);
