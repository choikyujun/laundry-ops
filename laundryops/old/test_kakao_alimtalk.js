/**
 * 카카오 알림톡 로컬 테스트 스크립트
 * 실행: node test_kakao_alimtalk.js
 * 
 * 테스트 수신번호는 사장님 번호(01051041648)로 고정되어 있음
 * 실제 배포 전 이 스크립트로 3개 탬플릿 모두 검증
 */

const SOLAPI_API_KEY    = 'NCSTYI3KU6TCNIJI';
const SOLAPI_API_SECRET = 'UP8BDGHQHMXG9XST8QHDI6URYK0NHJMP';
const SENDER_PHONE      = '01051041648';
const KAKAO_PF_ID       = 'KA01PF260422153127223YPBcJKYZEJU';
const TEST_RECEIVER     = '01051041648'; // ← 테스트 수신 번호 (사장님)

const TEMPLATES = {
  join:    'KA01TP260422154605730z7MOIK5LmLV',  // 세탁공장 회원가입 환영
  payment: 'KA01TP260422160154259RL62rYHexoE',  // 세탁공장 결제 수신 완료
  billing: 'KA01TP260422162254081G5IKK06soKf',  // 월정산 명세서 수신
};

const crypto = require('crypto');

// HMAC-SHA256 서명 생성 (Node.js 방식)
function makeSignature() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const msg  = date + salt;
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET).update(msg).digest('hex');
  return { date, salt, signature };
}

async function sendAlimtalk({ type, to, factoryName, expiryDate, hotelName, startDate, endDate, representativeName }) {
  const templateId = TEMPLATES[type];
  if (!templateId) throw new Error(`알 수 없는 type: ${type}`);

  // 탬플릿 변수 구성
  const variables = { '#{세탁공장이름}': factoryName };
  if (type === 'payment') variables['#{만료일}'] = expiryDate;
  if (type === 'billing') {
    variables['#{호텔이름}']   = hotelName;
    variables['#{조회시작일}'] = startDate;
    variables['#{조회종료일}'] = endDate;
  }
  if (type === 'join' && representativeName) {
    variables['#{세탁공장대표}'] = representativeName;
  }

  // 대체 SMS 문구
  let smsText = '';
  if (type === 'join')    smsText = `[LaundryOPS] ${factoryName} 가입이 승인되었습니다. 로그인하여 서비스를 이용해 주세요.`;
  if (type === 'payment') smsText = `[LaundryOPS] ${factoryName} 결제가 승인되었습니다. 이용 만료일: ${expiryDate}`;
  if (type === 'billing') smsText = `[LaundryOPS] ${factoryName} - ${hotelName} ${startDate}~${endDate} 월정산 명세서가 발송되었습니다.`;

  const { date, salt, signature } = makeSignature();

  const body = {
    message: {
      to:   to.replace(/-/g, ''),
      from: SENDER_PHONE,
      text: smsText,
      kakaoOptions: {
        pfId: KAKAO_PF_ID,
        templateId,
        disableSms: false,
        variables,
      },
    },
  };

  console.log('\n📤 발송 요청:');
  console.log(JSON.stringify(body, null, 2));

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  console.log('\n📩 응답:');
  console.log(JSON.stringify(result, null, 2));

  if (!res.ok || result.errorCode) {
    console.error('❌ 발송 실패:', result.errorMessage || JSON.stringify(result));
  } else {
    console.log('✅ 발송 성공!');
  }

  return result;
}

// ── 테스트 실행 ──────────────────────────────────────────────────
(async () => {
  const testType = process.argv[2] || 'all'; // node test_kakao_alimtalk.js join | payment | billing | all

  if (testType === 'join' || testType === 'all') {
    console.log('\n════════════════════════════════');
    console.log('🧪 [1] 가입 승인 알림톡 테스트');
    console.log('════════════════════════════════');
    await sendAlimtalk({
      type: 'join',
      to: TEST_RECEIVER,
      factoryName: '테스트세탁공장',
      representativeName: '홍길동',
    });
  }

  if (testType === 'payment' || testType === 'all') {
    console.log('\n════════════════════════════════');
    console.log('🧪 [2] 결제 승인 알림톡 테스트');
    console.log('════════════════════════════════');
    await sendAlimtalk({
      type: 'payment',
      to: TEST_RECEIVER,
      factoryName: '테스트세탁공장',
      expiryDate: '2026-07-23',
    });
  }

  if (testType === 'billing' || testType === 'all') {
    console.log('\n════════════════════════════════');
    console.log('🧪 [3] 월정산 명세서 알림톡 테스트');
    console.log('════════════════════════════════');
    await sendAlimtalk({
      type: 'billing',
      to: TEST_RECEIVER,
      factoryName: '테스트세탁공장',
      hotelName: '테스트호텔',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
  }
})();
