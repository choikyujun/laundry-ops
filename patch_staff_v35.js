window.loadAdminStaffList = async function() {
    const tbody = document.getElementById('adminStaffList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">직원 목록을 불러오는 중...</td></tr>';

    const { data: staffList, error: sErr } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(sErr) { tbody.innerHTML = `<tr><td colspan="3" style="color:red;">에러: ${sErr.message}</td></tr>`; }
    else if(!staffList || staffList.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">등록된 직원이 없습니다.</td></tr>'; }
    else {
        tbody.innerHTML = '';
        staffList.forEach(s => {
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td style="font-size:13px;">${s.login_id}<br><small style="color:var(--secondary)">PW: ${s.login_pw}</small></td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td>
            </tr>`;
        });
    }

    // Load recent invoices
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;
    activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행 현황 불러오는 중...</td></tr>';

    // Get page logic
    const itemsPerPage = 10;
    window.currentStaffPage = window.currentStaffPage || 1;
    
    // fetch total count
    const { count: totalInvoices, error: cErr } = await window.mySupabase.from('invoices').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    
    const startIdx = (window.currentStaffPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage - 1;

    const { data: invoices, error: iErr } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .order('created_at', { ascending: false })
        .range(startIdx, endIdx);

    if(iErr) { activityBody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${iErr.message}</td></tr>`; }
    else if(!invoices || invoices.length === 0) { activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>'; }
    else {
        activityBody.innerHTML = '';
        invoices.forEach(inv => {
            const displaySum = inv.total_amount || 0;
            const hName = (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음';
            activityBody.innerHTML += `<tr>
                <td style="font-size:12px;">${inv.date}</td>
                <td>${inv.staff_name || '직원'}</td>
                <td><strong>${hName}</strong></td>
                <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
            </tr>`;
        });
        
        const totalPages = Math.ceil((totalInvoices || 0) / itemsPerPage);
        const paginationContainer = document.getElementById('adminStaffPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = `
                <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(-1)" ${window.currentStaffPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                    <span style="font-weight: 600; color: #64748b;">${window.currentStaffPage} / ${totalPages || 1}</span>
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(1)" ${window.currentStaffPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
                </div>
            `;
        }
    }
};

window.changeStaffPage = function(dir) {
    window.currentStaffPage = (window.currentStaffPage || 1) + dir;
    window.loadAdminStaffList();
};

window.deleteStaff = async function(sId) {
    if(confirm('이 직원을 삭제하시겠습니까?')) {
        const { error } = await window.mySupabase.from('staff').delete().eq('id', sId);
        if(error) alert('삭제 실패: ' + error.message);
        else window.loadAdminStaffList();
    }
};

window.openStaffModal = function() {
    // 요금제 제한(1명 제한) 완전히 제거
    ['st_name', 'st_loginId', 'st_loginPw'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
        const err = document.getElementById('err_' + id);
        if(err) err.style.display = 'none';
    });
    openModal('staffModal');
};

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

    const { error } = await window.mySupabase.from('staff').insert([{
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
