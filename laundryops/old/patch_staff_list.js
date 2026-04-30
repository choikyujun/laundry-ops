window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    // [수정] author 가 '관리자(차감)'인 내역은 현장 직원 화면에 노출하지 않음
    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, author, hotels ( name )`)
        .eq('factory_id', currentFactoryId)
        .neq('author', '관리자(차감)');

    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        renderStaffInvoicePaging(0);
        return;
    }

    if (data.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        renderStaffInvoicePaging(0);
        return;
    }

    _staffInvoiceAllData = data;
    _staffInvoicePage = 1;
    if (typeof renderStaffInvoicePage === 'function') renderStaffInvoicePage();
};
