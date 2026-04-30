const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

app += `
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

    // 슈퍼어드민 고정 계정
    if (role === 'superadmin' && lId === 'admin' && password === '1111') {
        showView('superAdminView', '플랫폼 총괄 관리자');
        window.loadSuperAdminDashboard();
        return;
    }

    document.getElementById('loginDebugArea').style.display = 'block';
    document.getElementById('loginDebugArea').innerText = 'DB 확인 중...';

    // 1. 세탁공장 대표 로그인
    if (role === 'admin') {
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).eq('admin_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';
        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        if (data.status === 'pending') { alert('가입 승인 대기 중입니다. 플랫폼 관리자의 승인을 기다려주세요.'); return; }
        if (data.status === 'suspended') { alert('미운영 상태입니다. 관리자에게 문의하세요.'); return; }

        currentFactoryId = data.id;
        localStorage.setItem('currentFactoryId', data.id);
        if (!platformData.factories[data.id]) platformData.factories[data.id] = { hotels: {}, staffAccounts: {}, history: [] };
        
        showView('adminView', data.name + ' - 대표');
        window.loadAdminDashboard();
        return;
    }
    
    // 2. 현장 직원 로그인
    if (role === 'staff') {
        const { data, error } = await window.mySupabase.from('staff').select('*, factories(name)').eq('login_id', lId).eq('login_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';
        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentStaffName = data.name;
        localStorage.setItem('currentFactoryId', data.factory_id);

        showView('staffView', (data.factories ? data.factories.name : '세탁공장') + ' - 현장직원 (' + currentStaffName + ')');
        if(typeof window.loadStaffHotelSelect === 'function') window.loadStaffHotelSelect();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        return;
    }

    // 3. 거래처 파트너 로그인
    if (role === 'hotel') {
        const { data, error } = await window.mySupabase.from('hotels').select('*, factories(name, phone, ceo)').eq('login_id', lId).eq('login_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';
        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentHotelId = data.id;
        localStorage.setItem('currentFactoryId', data.factory_id);
        localStorage.setItem('currentHotelId', data.id);

        if (!platformData.factories[data.factory_id]) platformData.factories[data.factory_id] = { hotels: {}, staffAccounts: {}, history: [] };
        if (!platformData.factories[data.factory_id].hotels[data.id]) platformData.factories[data.factory_id].hotels[data.id] = { name: data.name };

        showView('hotelView', (data.factories ? data.factories.name : '세탁공장') + ' 파트너 대시보드');
        window.loadHotelDashboard();
        return;
    }
};
`;

fs.writeFileSync('app_v34.js', app);
console.log('Login function fully restored at bottom');
