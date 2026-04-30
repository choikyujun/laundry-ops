const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

code = code.replace(
    /window\.loadSuperAdminDashboard = async function\(\) \{/,
    `window.loadSuperAdminDashboard = async function() {
    // 플랫폼 관리자 정보 (ID, 연락처) 화면에 표시하기
    const { data: mConfig } = await window.mySupabase.from('platform_settings').select('admin_id, admin_phone').eq('id', 'master_config').maybeSingle();
    if (mConfig) {
        const saIdEl = document.getElementById('sa_id');
        const saPhoneEl = document.getElementById('sa_phone');
        if (saIdEl) saIdEl.value = mConfig.admin_id || '';
        if (saPhoneEl) saPhoneEl.value = mConfig.admin_phone || '';
    }
`
);

fs.writeFileSync('app_v38.js', code);
