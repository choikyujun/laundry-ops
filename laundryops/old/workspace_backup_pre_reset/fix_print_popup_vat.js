const fs = require('fs');

// 현장/대표자에서 1개씩 단건으로 보는 viewInvoiceDetail 에는 공급가만 있어야 한다. (이미 패치됨)
// 이제 방금 수정한 patch_admin_dashboard_stats_and_print.js를 다시 확인.

let content = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// 1. 인쇄/발송 팝업 (buildPrintAndSendReport)
// 2. 월정산 발송 내역 상세조회 (viewSentDetail)
// 3. 파트너거래처 화면 정산 리포트 수신함 상세 (viewSentDetail / viewSentReportByPeriod)

// 이미 위에 코드에서 replace로 "공급가: ₩ ... | 부가세: ₩ ... | 총 합계: ₩ ..." 로 변경했음. 
// 잘 들어갔는지 확인.
if (content.includes('부가세:')) {
    console.log("VAT logic is present.");
} else {
    console.log("Missing VAT logic.");
}

