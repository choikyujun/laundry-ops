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

    // 슈퍼어드민 계정 확인 (고정값 또는 변경된 로컬 저장값)
    if (role === 'superadmin') {
        const adminAuthStr = localStorage.getItem('adminAuth');
        let superAdminId = 'admin';
        let superAdminPw = '1111';
        if (adminAuthStr) {
            try {
                const parsed = JSON.parse(adminAuthStr);
                superAdminId = parsed.id;
                superAdminPw = parsed.pw;
            } catch(e) {}
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
                console.log(`[로그인 시점 업데이트] 구독상태가 ${newSubStatus} 로 변경되었습니다.`);
            }
            
            // 결제 유도 팝업 띄우기 (만료됨 또는 만료 임박)
            if (data.sub_status === 'expired' || data.sub_status === 'expiring') {
                if (data.sub_status !== 'trial') {
                    const msg = data.sub_status === 'expired' ? "요금제 기간이 만료되었습니다. 결제 후 계속 이용해 주세요." : "요금제 만료가 임박했습니다. 미리 결제해 주세요.";
                    document.getElementById('paymentMsg').innerText = msg;
                    openModal('paymentModal');
                    window.loadAdminPayment(); // 요금제 정보 로드
                }
            }
        }
        
        // 기존 호환성용 껍데기 세팅
        if (!platformData.factories[data.id]) platformData.factories[data.id] = { hotels: {}, staffAccounts: {}, history: [] };
        
        showView('adminView', data.name + ' - 대표');
        window.loadAdminDashboard();
        return;
    }
    
    // 2. 현장 직원 로그인 (staff 테이블 검색)
    if (role === 'staff') {
        // staff 테이블과 연결된 factories 테이블의 이름까지 조인해서 한 번에 가져옴!
        const { data, error } = await window.mySupabase
            .from('staff')
            .select('*, factories(name)')
            .eq('login_id', lId)
            .eq('login_pw', password)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentStaffName = data.name; localStorage.setItem('staffName', data.name); localStorage.setItem('currentStaffName', data.name);
        localStorage.setItem('currentFactoryId', data.factory_id);

        showView('staffView', (data.factories ? data.factories.name : '세탁공장') + ' - 현장직원 (' + currentStaffName + ')');
        
        // v34 전용 함수 (나중에 구현)
        if(typeof window.loadStaffHotelSelect === 'function') window.loadStaffHotelSelect();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        return;
    }

    // 3. 거래처 파트너 로그인 (hotels 테이블 검색)
    if (role === 'hotel') {
        const { data, error } = await window.mySupabase
            .from('hotels')
            .select('*, factories(name, phone, ceo)')
            .eq('login_id', lId)
            .eq('login_pw', password)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentHotelId = data.id;
        localStorage.setItem('currentFactoryId', data.factory_id);
