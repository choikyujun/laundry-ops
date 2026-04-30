window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    document.getElementById('deductDate').value = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    
    // 거래처의 단가표(품목 목록) 불러오기
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const itemSelect = document.getElementById('deductItemSelect');
    itemSelect.innerHTML = '<option value="">품목을 선택하세요 (단가표 기준)</option>';
    
    if (prices && prices.length > 0) {
        prices.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.dataset.price = p.price;
            opt.innerText = `${p.name} (${p.price}원 / ${p.unit || '장'})`;
            itemSelect.appendChild(opt);
        });
    } else {
        itemSelect.innerHTML += '<option value="" disabled>등록된 품목이 없습니다.</option>';
    }
    
    document.getElementById('deductPrice').value = '0';
    document.getElementById('deductQty').value = '-1';
    
    openModal('deductionModal');
};

window.handleDeductItemChange = function() {
    const itemSelect = document.getElementById('deductItemSelect');
    const selected = itemSelect.options[itemSelect.selectedIndex];
    if (selected && selected.dataset.price) {
        document.getElementById('deductPrice').value = selected.dataset.price;
    } else {
        document.getElementById('deductPrice').value = '0';
    }
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    const itemSelect = document.getElementById('deductItemSelect');
    const itemName = itemSelect.value;
    const price = Number(document.getElementById('deductPrice').value);
    const qty = Number(document.getElementById('deductQty').value);

    if (!hId || !date || !itemName) {
        alert('날짜와 품목을 모두 선택해주세요.');
        return;
    }
    
    if (qty === 0 || qty > 0) {
        alert('차감 수량은 반드시 마이너스(-) 값이어야 합니다. 예: -5');
        return;
    }

    const itemTotal = price * qty; // 예: 500원 * -5 = -2500원
    
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
        // 총액 업데이트
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

    // 아이템 추가 (차감 명목임을 명시하기 위해 이름에 '[클레임/차감]' 등 태그를 붙일지 물어볼 수도 있지만,
    // 사장님 요청은 "어떤 품목에서 - 수량을 입력해서 적용됐는지가 중요해" 이므로 원본 품목명을 그대로 쓰고 수량만 마이너스로 함.
    // 혹시 구분을 위해 "품목명 (차감)" 형태로 넣으면 통계나 명세서 리스트에 명확하게 나옴.
    await window.mySupabase.from('invoice_items').insert([{
        invoice_id: invoiceId,
        name: itemName + ' (클레임차감)',
        price: price,
        qty: qty
    }]);

    closeModal('deductionModal');
    alert(`[${itemName}] ${qty}개 차감 내역이 성공적으로 등록되었습니다.`);
    loadAdminRecentInvoices(); // 목록 갱신
};
