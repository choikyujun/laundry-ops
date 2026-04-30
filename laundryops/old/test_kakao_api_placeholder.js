const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

if (!code.includes('window.sendKakaoOrMessage')) {
    code += `\n
// ==========================================
// [v39 준비] 카카오 알림톡/문자 API 연동 (Aligo)
// ==========================================
window.sendKakaoOrMessage = async function(hotelId, sDate, eDate, supplyPrice, totalAmount) {
    console.log("DEBUG: sendKakaoOrMessage called with:", { hotelId, sDate, eDate, supplyPrice, totalAmount });
    
    // 1. 거래처(수신자) 정보 조회
    const { data: h } = await window.mySupabase.from('hotels').select('name, phone').eq('id', hotelId).single();
    if (!h || !h.phone) {
        throw new Error("거래처의 연락처 정보가 없습니다.");
    }
    
    // 2. 공장(발신자) 정보 조회
    const { data: f } = await window.mySupabase.from('factories').select('name, phone').eq('id', currentFactoryId).single();
    if (!f) {
        throw new Error("공장 정보를 불러올 수 없습니다.");
    }
    
    // 3. 발송할 데이터 페이로드 (알림톡 템플릿 변수 매핑)
    const payload = {
        receiver: h.phone.replace(/[^0-9]/g, ''), // 수신자 번호 (숫자만)
        sender: f.phone ? f.phone.replace(/[^0-9]/g, '') : '01000000000', // 발신자 번호 (알리고에 등록된 번호여야 함)
        
        // 템플릿에 들어갈 변수들
        tpl_button_url: \`https://laundryops.com/partner_view.html?factory=\${currentFactoryId}&hotel=\${hotelId}&s=\${sDate}&e=\${eDate}\`, // 임시 URL
        
        variables: {
            "#{거래처명}": h.name,
            "#{세탁공장명}": f.name,
            "#{시작일}": sDate,
            "#{종료일}": eDate,
            "#{총금액}": totalAmount.toLocaleString(),
            "#{공장연락처}": f.phone || '등록된 번호 없음'
        }
    };
    
    console.log("알림톡 발송 준비 완료 (API 연동 대기중):", payload);
    
    // 월요일에 이 부분에 실제 Supabase Edge Function 호출 로직이 들어갑니다.
    // const res = await fetch('https://[PROJECT_REF].supabase.co/functions/v1/send-aligo', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer [ANON_KEY]' },
    //     body: JSON.stringify(payload)
    // });
    // if (!res.ok) throw new Error("문자 발송 서버 에러");
    
    // 현재는 테스트를 위해 1초 대기 후 성공 처리
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
};
`;
    fs.writeFileSync('app_v38.js', code);
}
