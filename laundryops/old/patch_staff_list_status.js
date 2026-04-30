// 현장직원 화면 명세서 목록 상태 수정 및 삭제 버튼 제거
window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDate = document.getElementById('staffSearchDate') ? document.getElementById('staffSearchDate').value : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`
            id, date, total_amount, is_sent, staff_name,
            hotels ( name )
        `)
        .eq('factory_id', currentFactoryId);

    if (searchDate) {
        query = query.eq('date', searchDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(30);

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">오류가 발생했습니다.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
        // 상태 값을 "발행됨"으로 고정
        const statusBadge = '<span class="badge" style="background:var(--success);">발행됨</span>';

        tbody.innerHTML += `
        <tr>
            <td>${inv.date}</td>
            <td style="font-weight:700;">${hName}</td>
            <td style="text-align:right;">${inv.total_amount.toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td>${inv.staff_name || '직원'}</td>
            <td>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                <!-- 현장직원은 삭제 권한이 없으므로 삭제 버튼 제거 -->
            </td>
        </tr>`;
    });
};
