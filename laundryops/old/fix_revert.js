const fs = require('fs');
// Let's restore the entire file from backup_v38_final/app_v38.js
fs.copyFileSync('backup/v38_final/app_v38.js', 'app_v38.js');
