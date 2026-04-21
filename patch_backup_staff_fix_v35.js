window.backupFactoryData = async function() {
    if (typeof window.checkAdminExpired === 'function' && await window.checkAdminExpired()) return;

    // 무료 사용자 제한 해제
    if (!confirm('현재 데이터를 백업 파일로 저장하시겠습니까?')) return;
    
    // v35: Supabase RDBMS에 맞춘 데이터 백업 로직이어야 하지만, 
    // 기존 JSON 기반 백업 기능을 그대로 살리거나(하위 호환), 현재 DB를 JSON으로 덤프
    alert('DB 기반 백업 기능은 현재 개발 중입니다.');
    // 기존 로직 유지
    const f = platformData.factories[currentFactoryId];
    if(!f) return;
    const blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laundry_ops_backup_${currentFactoryId}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.openRestoreDialog = function() {
    if (typeof window.checkAdminExpired === 'function' && window.checkAdminExpired()) return;

    // 무료 사용자 제한 해제
    document.getElementById('restoreFile').click();
};

window.restoreFactoryData = function(input) {
    if (!confirm('업로드한 데이터로 시스템을 복구하고 새로고침하시겠습니까?')) {
        input.value = '';
        return;
    }

    const file = input.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(!data.hotels || !data.history) throw new Error('올바르지 않은 백업 파일 형식입니다.');
            
            platformData.factories[currentFactoryId] = data;
            saveData();
            alert('데이터 복구가 완료되었습니다. 페이지를 새로고침합니다.');
            location.reload();
        } catch(err) {
            alert('복구 실패: ' + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
};

// Staff ID 누락 에러 픽스
window.saveNewStaff = async function() {
    const nameInput = document.getElementById('st_name');
    const idInput = document.getElementById('st_loginId');
    const pwInput = document.getElementById('st_loginPw');

    const name = nameInput.value.trim();
    const lId = idInput.value.trim();
    const lPw = pwInput.value.trim();

    let isValid = true;
    if (!name) { nameInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_name').style.display = 'block'; isValid = false; }
    if (!lId) { idInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginId').style.display = 'block'; isValid = false; }
    if (!lPw) { pwInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginPw').style.display = 'block'; isValid = false; }

    if (!isValid) return;

    // ID 중복 체크 (DB 쿼리)
    const { data: exist } = await window.mySupabase.from('staff').select('id').eq('login_id', lId).maybeSingle();
    if (exist) {
        alert('이미 사용중인 아이디입니다.');
        return;
    }

    // crypto.randomUUID()로 id 명시적 생성 (not-null constraint 해결)
    const newId = crypto.randomUUID();

    const { error } = await window.mySupabase.from('staff').insert([{
        id: newId,
        factory_id: currentFactoryId,
        name: name,
        login_id: lId,
        login_pw: lPw
    }]);

    if (error) {
        alert('등록 실패: ' + error.message);
    } else {
        closeModal('staffModal');
        window.loadAdminStaffList();
    }
};

// 특수거래처 제한 해제
window.checkSpecialHotelAccess = function(value) {
    // 무료 사용자(라이트/비즈니스) 제한 해제 - 아무것도 안 함 (항상 허용)
    console.log("특수거래처 선택 허용됨:", value);
};
