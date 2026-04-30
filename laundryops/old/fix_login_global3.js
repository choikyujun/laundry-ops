const fs = require('fs');
let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

html = html.replace(/onclick="login\(\)"/g, 'onclick="window.login()"');
html = html.replace(/onkeydown="if\(event\.key==='Enter'\) login\(\)"/g, 'onkeydown="if(event.key===\'Enter\') window.login()"');

fs.writeFileSync('거래명세서프로그램v38.html', html);
