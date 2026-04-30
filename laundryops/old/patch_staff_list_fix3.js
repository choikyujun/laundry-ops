window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', currentFactoryId);

    // [수정] .neq() 쿼리에서 발생하는 에러일 수 있으므로, 서버 쿼리는 전체를 가져오고 프론트에서 필터링
    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 프론트엔드에서 '관리자(차감)' 데이터를 걸러냄 (DB 구조나 버전에 구애받지 않는 가장 안전한 방식)
    const filteredData = data.filter(inv => inv.staff_name !== '관리자(차감)');

    if (filteredData.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 전역 변수에 데이터 저장 후 페이징 렌더 함수 호출
    // 레거시 코드와 완벽 호환되도록 전역 객체명 원복
    window._staffInvoiceAllData = filteredData;
    window._staffInvoicePage = 1;
    
    if (typeof window.renderStaffInvoicePage === 'function') {
        window.renderStaffInvoicePage();
    } else if (typeof renderStaffInvoicePage === 'function') {
        renderStaffInvoicePage();
    } else {
        console.error("renderStaffInvoicePage 함수가 없습니다.");
    }
};
