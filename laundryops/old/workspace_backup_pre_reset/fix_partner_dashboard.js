// 위에서 만든 코드를 HTML에 삽입
const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v35.html', 'utf8');

// replace the end tag
html = html.replace('</body>', '<script src="patch_partner_dashboard_v35.js"></script>\n</body>');

fs.writeFileSync('거래명세서프로그램v35.html', html);
console.log('Injected partner view script into HTML');
