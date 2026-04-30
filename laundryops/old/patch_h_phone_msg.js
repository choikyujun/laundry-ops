const fs = require('fs');
let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

const target = `<div class="form-group"><label>전화번호</label><input type="text" id="h_phone"></div>`;
const replacement = `<div class="form-group">
                <label>전화번호</label>
                <input type="text" id="h_phone">
                <div style="font-size: 11px; color: var(--primary); margin-top: 4px;">* 카카오 알림톡 수신을 위해 정확한 휴대폰 번호를 입력해주세요.</div>
            </div>`;

html = html.replace(target, replacement);

fs.writeFileSync('거래명세서프로그램v38.html', html);
