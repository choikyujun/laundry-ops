const fs = require('fs');
const html = fs.readFileSync('거래명세서프로그램v35.html', 'utf-8');
const lines = html.split('\n');
lines.forEach((l, i) => {
    if(l.includes('patch_')) {
        console.log(`Line ${i+1}: ${l}`);
    }
});
