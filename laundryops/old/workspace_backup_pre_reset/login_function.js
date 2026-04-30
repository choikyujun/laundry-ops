window.login = async function() {
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    if(!roleEl || !idEl || !pwEl) return;

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const password = pwEl.value.trim();

    if (role === '선택하세요' || !role) { alert('역할을 선택해주세요.'); return; }
    if (!lId || !password) { alert('ID와 비밀번호를 입력해주세요.'); return; }

    // 슈퍼어드민 계정 확인 (SQL-First DB 연동)
    if (role === 'superadmin') {
        const { data: settings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
        
        let superAdminId = 'admin'; // 기본값 (테이블이 비어있을 경우 대비)
        let superAdminPw = '1111';  // 기본값
        
        if (settings && settings.admin_id) {
            superAdminId = settings.admin_id;
            superAdminPw = settings.admin_pw;
        }
        
        if (lId === superAdminId && password === superAdminPw) {
            showView('superAdminView', '플랫폼 총괄 관리자');
            window.loadSuperAdminDashboard();
            if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
            return;
        } else {
            alert('슈퍼관리자 ID 또는 비밀번호가 일치하지 않습니다.');
            return;
        }
    }

    document.getElementById('loginDebugArea').style.display = 'block';
    document.getElementById('loginDebugArea').innerText = 'DB 확인 중...';

    // 1. 세탁공장 대표 로그인 (factories 테이블 검색)
    if (role === 'admin') {
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).eq('admin_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        if (data.status === 'pending') { alert('가입 승인 대기 중입니다. 플랫폼 관리자의 승인을 기다려주세요.'); return; }
        if (data.status === 'suspended') { alert('미운영 상태입니다. 관리자에게 문의하세요.'); return; }

        currentFactoryId = data.id;
        localStorage.setItem('currentFactoryId', data.id);
        
        // [만료일 체크 및 구독 상태 자동 업데이트]
        if (data.plan_expiry) {
            const expiry = new Date(data.plan_expiry);
            expiry.setHours(23, 59, 59, 999); // 만료일 당일까지는 만료되지 않은 것으로 처리
            const today = new Date();
            
            let newSubStatus = data.sub_status;
            
            if (expiry < today) {
                newSubStatus = 'expired';
            } else if (expiry - today < 15 * 24 * 60 * 60 * 1000) { // 15일 이내
                newSubStatus = 'expiring';
            } else {
                newSubStatus = 'active';
            }
            
            // DB 업데이트 수행
            if (newSubStatus !== data.sub_status) {
                await window.mySupabase.from('factories').update({ sub_status: newSubStatus }).eq('id', data.id);
                data.sub_status = newSubStatus; // 현재 객체 상태도 업데이트
