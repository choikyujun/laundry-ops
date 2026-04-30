// 1. 발송 내역 보기 (adminSentList, partnerReceivedList) 는 원래 invoice 하나를 보는 것과 같습니다.
// 2. 관리자 인쇄/발송 팝업과 파트너 팝업을 모두 포괄하는 함수 작성

const code = `
// [추가 패치] 3가지 팝업 (인쇄/발송 팝업, 발송내역 팝업, 파트너 수신함 팝업) 모두 부가세/총합계 포함되게 복구
window.viewSentDetail = async function(hotelName, period, sentAt, isPartnerView) {
    const { data: hotels } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).eq('name', hotelName);
    const h = hotels && hotels.length > 0 ? hotels[0] : null;

    if (!h) {
        alert('거래처 정보를 찾을 수 없습니다.');
        return;
    }

    let sDate, eDate;
    if (period.includes('~')) {
        [sDate, eDate] = period.split(' ~ ').map(s => s.trim());
    } else {
        sDate = period;
        eDate = period;
    }

    // 인쇄/발송 팝업용 함수 재사용
    const report = await window.buildPrintAndSendReport(h.id, sDate, eDate);
    if (!report) return;

    let finalHtml = report.html;
    
    // 파트너 뷰일 때 정산 버튼 추가 로직
    if (isPartnerView) {
        const isConfirmed = h.confirmed_months && (h.confirmed_months[sentAt] === true);
        const confirmBtnHtml = !isConfirmed ? \`<button class="btn btn-save no-print" style="padding: 15px 40px; cursor: pointer; font-size: 16px; background:#10b981; border:none; color:white; font-weight:700;" onclick="confirmSentReportByPeriod('\${sentAt}')">✅ 정산 확인 완료</button>\` : '<div style="color: var(--success); font-weight: 700; font-size: 16px;">✅ 이미 확인된 내역입니다.</div>';
        finalHtml += \`
        <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄하기</button>
            \${confirmBtnHtml}
        </div>\`;
    } else {
        finalHtml += \`
        <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄창 열기</button>
        </div>\`;
    }

    const detailArea = document.getElementById('invoiceDetailArea');
    if (detailArea) {
        detailArea.innerHTML = finalHtml;
        openModal('invoiceDetailModal');
    } else {
        alert('상세내역을 불러왔습니다 (모달 영역이 없습니다).');
    }
};

window.viewSentReportByPeriod = async function(period, sentAt) {
    const hId = currentHotelId;
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    await window.viewSentDetail(h.name, period, sentAt, true);
};
`;

const fs = require('fs');
let content = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// buildPrintAndSendReport 에 부가세, 총합계를 추가해야 함.
content = content.replace(/공급가\(합계\): ₩ \$\{supplyPrice.toLocaleString\(\)\}/g, 
    '공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ ${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}');

// 만약 이미 바뀌어있을 수 있으니 한 번 더 확인
if(!content.includes('부가세: ₩')) {
    console.log("Failed to inject VAT into buildPrintAndSendReport");
}

fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', content + '\n' + code);
console.log("Patched viewSentDetail and injected VAT into print report");

