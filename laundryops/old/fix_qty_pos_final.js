const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I already replaced `it.netQty` with `it.posQty` at 15:52 !
// Wait, the user is saying: "새롭게 차감하여 발송한 내역서는 , 월정산 발송 내역>>내역확인 팝업에 차감내역이 보여야 해" at 15:32
// Oh! Did I miss answering the user's 15:32 request?
// And then I responded to 15:41 without addressing 15:32 !!

// Let's re-read the timeline.
// User 15:32: "새롭게 차감하여 발송한 내역서는 , 월정산 발송 내역>>내역확인 팝업에 차감내역이 보여야 해"
// My last answer was sent after 15:37 ("로그인 에러").
// Then user 15:41: "아까 말했잖아. 내가 배포해 라고 말하기 전까지는 dist , backup 폴더에 복사하지 마."
// Then user 15:43: "월정산 리포트 발송 버튼을 통해서 정산 리포트를 수량을 차감하여 발송완료 했어. 그러나 월정산 발송 내역 화면에 내역확인 팝업에 차감내역이 안보여"

// Then I answered at 15:51 regarding the "유령 발송 내역".

// Then User 15:52: "월정산리포트 발송 팝업에서 (특수거래처 일경우), 차감을 하면 , 수량(합계)화면에서 수량이 빠져서 보여, 수량(합계)는 그대로 보이고, 차감 수량의 숫자만큼 빼서 계산하면 돼"

// Wait! I ALREADY updated it to `it.posQty` inside `fix_qty_display.js` but I haven't replied to the user yet!
