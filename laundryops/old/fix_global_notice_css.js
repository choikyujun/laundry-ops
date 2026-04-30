const fs = require('fs');

// Check if 'globalNoticeBar' exists in HTML and where it's located.
let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

console.log(html.includes('globalNoticeBar'));
const lines = html.split('\n');
for(let i = 0; i < lines.length; i++) {
    if (lines[i].includes('globalNoticeBar')) {
        console.log(`Line ${i+1}: ${lines[i]}`);
    }
}
