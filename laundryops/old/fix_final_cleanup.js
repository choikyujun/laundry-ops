const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I still need to make sure the global login exists at the end.
if (!code.includes('window.login = window.login || function() {};')) {
    code += `\n\n// [전역 강제 연결] login() 함수 전역 스코프 노출\nwindow.login = window.login || function() {};\nfunction login() { window.login(); }\n`;
}

fs.writeFileSync('app_v38.js', code);
