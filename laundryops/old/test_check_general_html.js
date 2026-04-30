const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const regex = /<tr style="background: #e2e8f0; font-weight: 700;">\s*<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계<\/td>\s*\$\{(.*?)netQty(.*?)\}\s*<\/tr>/g;
let matches = [...code.matchAll(regex)];

if (matches.length > 0) {
    console.log("Found matches in General Hotel footer.");
}

// In general hotel HTML, `수량 합계` row uses `posQty + negQty` -> `netQty`? 
// Wait, for general hotel, they show individual dates, then `월말 차감`, then `수량 합계`.
// Should `수량 합계` be `posQty` and then there's a new `최종 수량(순)`?
// Or is the current way (Date ..., 월말 차감, 수량 합계(net)) correct for general?
// The user only complained about the special hotel 2-column layout:
// "월정산리포트 발송 팝업에서 (특수거래처 일경우), 차감을 하면 , 수량(합계)화면에서 수량이 빠져서 보여, 수량(합계)는 그대로 보이고, 차감 수량의 숫자만큼 빼서 계산하면 돼"
