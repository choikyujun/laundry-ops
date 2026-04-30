const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

const loginBtnLine = html.split('\n').find(l => l.includes('로그인</button>'));
console.log(loginBtnLine);
