const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

// Insert phone field into the HTML
html = html.replace(
    /<div class="form-group"><label>비밀번호<\/label><input type="password" id="sa_pw" placeholder="관리자 비밀번호"><\/div>/,
    `<div class="form-group"><label>비밀번호</label><input type="password" id="sa_pw" placeholder="관리자 비밀번호"></div>\n            <div class="form-group"><label>관리자 연락처</label><input type="text" id="sa_phone" placeholder="010-0000-0000 (숫자만)"></div>`
);

fs.writeFileSync('거래명세서프로그램v38.html', html);
