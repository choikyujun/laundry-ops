window.login = async function() {
    console.log("DEBUG: login() called");
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    if(!roleEl || !idEl || !pwEl) return;

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const password = pwEl.value.trim();

    if (role === '선택하세요' || !role) { alert('역할을 선택해주세요.'); return; }
    if (!lId || !password) { alert('ID와 비밀번호를 입력해주세요.'); return; }

    if (role === 'superadmin') {
        const { data: settings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
        let superAdminId = 'admin';
        let superAdminPw = '1111';
        if (settings && settings.admin_id) { superAdminId = settings.admin_id; superAdminPw = settings.admin_pw; }
        
        if (lId === superAdminId && password === superAdminPw) {
            window.showView('superAdminView', '플랫폼 총괄 관리자');
            if(window.loadSuperAdminDashboard) window.loadSuperAdminDashboard();
            if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
            return;
        } else {
            alert('슈퍼관리자 ID 또는 비밀번호가 일치하지 않습니다.');
            return;
        }
    }

    document.getElementById('loginDebugArea').style.display = 'block';
    document.getElementById('loginDebugArea').innerText = 'DB 확인 중...';

    if (role === 'admin') {
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).eq('admin_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        if (data.status === 'pending') { alert('가입 승인 대기 중입니다. 플랫폼 관리자의 승인을 기다려주세요.'); return; }
        if (data.status === 'suspended') { alert('미운영 상태입니다. 관리자에게 문의하세요.'); return; }

        window.currentFactoryId = data.id;
        localStorage.setItem('currentFactoryId', data.id);
        
        if (data.plan_expiry) {
            const expiry = new Date(data.plan_expiry);
            expiry.setHours(23, 59, 59, 999);
            const today = new Date();
            let newSubStatus = data.sub_status;
            if (expiry < today) newSubStatus = 'expired';
            if (newSubStatus !== data.sub_status) await window.mySupabase.from('factories').update({sub_status: newSubStatus}).eq('id', data.id);
        }
        
        window.showView('adminView', data.name + ' - 대표');
        window.setupRealtimeSubscription();
        await window.loadAdminDashboard();
    } else if (role === 'staff') {
        const { data, error } = await window.mySupabase.from('staff').select('*, factories(name)').eq('login_id', lId).eq('login_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';
        if (error || !data) { alert('직원 ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        window.currentFactoryId = data.factory_id;
        localStorage.setItem('currentFactoryId', data.factory_id);
        window.currentStaffName = data.name;
        window.showView('staffView', data.factories.name + ' - 현장직원');
        await window.loadStaffInvoiceList();
    } else if (role === 'hotel') {
        const { data, error } = await window.mySupabase.from('hotels').select('*, factories(name, phone, ceo)').eq('login_id', lId).eq('login_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';
        if (error || !data) { alert('거래처 ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        window.currentFactoryId = data.factory_id;
        localStorage.setItem('currentFactoryId', data.factory_id);
        localStorage.setItem('currentHotelId', data.id);
        window.editingHotelId = data.id;
        window.showView('hotelView', data.name + ' - 파트너');
        await window.loadHotelDashboard();
    }
};
