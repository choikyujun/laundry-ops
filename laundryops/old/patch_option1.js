window.openDeductionModal = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    document.getElementById('deductHotelName').innerText = hotelFilter.options[hotelFilter.selectedIndex].text;
    document.getElementById('deductHotelId').value = hotelFilter.value;
    document.getElementById('deductDate').value = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    document.getElementById('deductItemName').value = '[월말 클레임/재탕 정산]';
    document.getElementById('deductPrice').value = '-10000';
    document.getElementById('deductQty').value = '1';
    openModal('deductionModal');
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    const itemName = document.getElementById('deductItemName').value.trim();
    const price = Number(document.getElementById('deductPrice').value);
    const qty = Number(document.getElementById('deductQty').value);

    if (!hId || !date || !itemName || qty === 0) return;

    const itemTotal = price * qty;
    
    // 1. 기존 명세서 확인
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        // 기존 아이템 놔두고 추가만 함 (원래 로직은 덮어쓰기지만, 차감은 기존 항목 유지)
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + itemTotal })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: itemTotal,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 추가
    await window.mySupabase.from('invoice_items').insert([{
        invoice_id: invoiceId,
        name: itemName,
        price: price,
        qty: qty
    }]);

    closeModal('deductionModal');
    alert('차감 내역이 성공적으로 등록되었습니다.');
    loadAdminRecentInvoices(); // 목록 갱신
};
