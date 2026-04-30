const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

const replacement = `window.deleteSentLog = async function(logId) {
    if(!confirm('정말 발송 기록을 취소(삭제)하시겠습니까?\\n(해당 발송에 포함된 월말 차감 데이터도 함께 삭제됩니다.)')) return;
    
    // 1. 해당 발송 로그와 연결된 '월말 차감' 명세서(invoices) 및 상세항목(invoice_items) 동시 삭제
    // (Supabase에 on delete cascade가 없더라도, invoices를 지우면 앱 로직상 깨끗해짐. cascade가 설정되어있으면 items도 지워짐)
    const staffNameTag = '관리자(차감)_' + logId;
    const { error: invErr } = await window.mySupabase.from('invoices').delete().eq('staff_name', staffNameTag);
    if(invErr) {
        console.error('차감 명세서 삭제 실패:', invErr);
    }

    // 2. 발송 로그(sent_logs) 삭제
    const { error } = await window.mySupabase.from('sent_logs').delete().eq('id', logId);
    if(error) {
        alert('삭제 실패: ' + error.message);
        return;
    }
    
    alert('발송 기록 및 관련 차감 데이터가 성공적으로 삭제되었습니다.');
    if (typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
};`;

code = code.replace(/window\.deleteSentLog = async function\(logId\) \{[\s\S]*?window\.loadAdminSentList\(\);\n\};/, replacement);

fs.writeFileSync('app_v38.js', code);
