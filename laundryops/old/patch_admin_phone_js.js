const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

const replaceStr = `window.saveAdminCredentials = async function() {
    const id = document.getElementById('sa_id').value.trim();
    const pw = document.getElementById('sa_pw').value.trim();
    const phoneEl = document.getElementById('sa_phone');
    const phone = phoneEl ? phoneEl.value.trim() : '';

    if(!id || !pw) { alert('ID와 비밀번호를 모두 입력하세요.'); return; }
    
    // 플랫폼 설정에 admin_phone 추가 (먼저 Supabase 테이블에 해당 컬럼을 추가해야 합니다!)
    const payload = { id: 'master_config', admin_id: id, admin_pw: pw };
    if (phone) payload.admin_phone = phone;

    const { error } = await window.mySupabase.from('platform_settings').upsert(payload);
        
    if (error) { 
        alert('계정 저장 중 오류가 발생했습니다: ' + error.message + '\\n(혹시 admin_phone 컬럼이 없다면 Supabase에서 추가해주세요.)'); 
        return; 
    }
    
    alert('플랫폼 총괄 관리자 정보가 데이터베이스에 안전하게 변경/저장되었습니다.\\n새로운 계정으로 다시 로그인해 주세요.');
    location.reload();
};`;

// replace the function
code = code.replace(/window\.saveAdminCredentials = async function\(\) \{[\s\S]*?location\.reload\(\);\n\};/g, replaceStr);

fs.writeFileSync('app_v38.js', code);
