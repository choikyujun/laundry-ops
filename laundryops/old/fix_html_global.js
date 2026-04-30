const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');
html = html.replace(/onclick="window\.login\(\)"/g, 'onclick="login()"');
html = html.replace(/onkeydown="if\(event\.key==='Enter'\) window\.login\(\)"/g, 'onkeydown="if(event.key===\'Enter\') login()"');

fs.writeFileSync('거래명세서프로그램v38.html', html);

let code = fs.readFileSync('app_v38.js', 'utf-8');
if (!code.includes('window.login = window.login || function() {};')) {
    code += `\n\n// [전역 강제 연결] login() 함수 전역 스코프 노출\nwindow.login = window.login || function() {};\nfunction login() { window.login(); }\n`;
    fs.writeFileSync('app_v38.js', code);
}
