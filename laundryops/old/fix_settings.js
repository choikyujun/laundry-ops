const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

code = code.replace(
    /window\.saveAdminCredentials = async function\(\) \{[\s\S]*?location\.reload\(\);\n\};/,
    `window.saveAdminCredentials = async function() {
    const id = document.getElementById('sa_id').value.trim();
    const pw = document.getElementById('sa_pw').value.trim();
    const phoneEl = document.getElementById('sa_phone');
    const phone = phoneEl ? phoneEl.value.trim() : '';

    if(!id || !pw) { alert('ID와 비밀번호를 모두 입력하세요.'); return; }
    
    // 기존 데이터 보존
    const { data: currentSettings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
    const payload = currentSettings || { id: 'master_config' };
    
    payload.admin_id = id;
    payload.admin_pw = pw;
    if (phone) payload.admin_phone = phone;

    const { error } = await window.mySupabase.from('platform_settings').upsert(payload);
        
    if (error) { 
        alert('계정 저장 중 오류가 발생했습니다: ' + error.message + '\\n(혹시 admin_phone 컬럼이 없다면 Supabase에서 추가해주세요.)'); 
        return; 
    }
    
    alert('플랫폼 총괄 관리자 정보가 데이터베이스에 안전하게 변경/저장되었습니다.\\n새로운 계정으로 다시 로그인해 주세요.');
    location.reload();
};`
);

code = code.replace(
    /window\.saveNotice = async function\(\) \{[\s\S]*?if \(error\) \{ alert\('공지사항 저장 중 오류가 발생했습니다: ' \+ error\.message\); return; \}\n\s*alert\('공지사항이 저장되었습니다\.'\);\n\s*location\.reload\(\);\n\};/,
    `window.saveNotice = async function() {
    const noticeContent = document.getElementById('globalNoticeInput').value.trim();
    
    const { data: currentSettings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
    const payload = currentSettings || { id: 'master_config' };
    
    payload.global_notice = noticeContent;
    
    const { error } = await window.mySupabase.from('platform_settings').upsert(payload);
    
    if (error) { alert('공지사항 저장 중 오류가 발생했습니다: ' + error.message); return; }
    
    alert('공지사항이 저장되었습니다.');
    location.reload();
};`
);

fs.writeFileSync('app_v38.js', code);
