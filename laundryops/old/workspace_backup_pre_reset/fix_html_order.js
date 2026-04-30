const fs = require('fs');
let html = fs.readFileSync('거래명세서프로그램v35.html', 'utf-8');

// 제거할 패치 파일들 (v35_final_v3.js 가 마지막에 동작하도록)
const toRemove = [
    '<script src="patch_view_detail_single_all_items.js"></script>',
    '<script src="patch_view_detail_single.js"></script>',
    '<script src="patch_view_invoice_detail_v35_fix.js"></script>',
    '<script src="patch_view_detail.js"></script>'
];

toRemove.forEach(str => {
    html = html.replace(str, '');
});

// v35_final_v3.js 위치를 제일 밑으로 조정
html = html.replace('<script src="patch_v35_final_v3.js"></script>', '');
html = html.replace('</body>', '<script src="patch_v35_final_v3.js"></script>\n</body>');

fs.writeFileSync('거래명세서프로그램v35.html', html);
console.log('HTML 순서 수정 완료');
