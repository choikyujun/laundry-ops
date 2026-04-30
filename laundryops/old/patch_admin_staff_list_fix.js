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

    // Load recent invoices (직원/발행 화면 하단 발행 현황 목록)
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;
    
    // pagination for staff activity list
    const itemsPerPage = 10;
    window.currentStaffPage = window.currentStaffPage || 1;
    const startIdx = (window.currentStaffPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage - 1;

    // [수정] 관리자(차감) 명세서는 직원 발행 현황에서도 보이지 않도록 필터링
    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        .neq('staff_name', '관리자(차감)')
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
        
        // (페이징 버튼 렌더링 로직 유지)
        const paginationDiv = document.getElementById('adminStaffPagination');
        if(paginationDiv && count) {
            const totalPages = Math.ceil(count / itemsPerPage);
            let pageHtml = '<div style="margin-top:10px; text-align:center;">';
            for (let i = 1; i <= totalPages; i++) {
                if (i === window.currentStaffPage) {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:var(--primary); color:white; border:none; border-radius:4px;">${i}</button>`;
                } else {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;" onclick="window.currentStaffPage=${i}; window.loadAdminStaffList()">${i}</button>`;
                }
            }
            pageHtml += '</div>';
            paginationDiv.innerHTML = pageHtml;
        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
};
