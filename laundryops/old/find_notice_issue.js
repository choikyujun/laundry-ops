const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

// 1. Is there anything hiding the notice bar?
console.log(code.includes('globalNoticeBar.style.display = '));
// 2. Are there CSS rules hiding `.app-container` siblings? No.
