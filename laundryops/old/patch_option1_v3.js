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
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${p.price}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="number" class="deduct-qty-input" data-name="${p.name}" placeholder="0" style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    
    if (!hId || !date) {
        alert('날짜를 선택해주세요.');
        return;
    }

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value);
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        } else if (qty > 0) {
            alert(`[${input.getAttribute('data-name')}] 차감 수량은 반드시 마이너스(-) 값이어야 합니다.`);
            throw new Error('Positive quantity not allowed in deduction');
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 마이너스(-) 기호와 함께 입력해주세요. (예: -5)');
        return;
    }

    const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
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
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + totalDeductionAmount })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalDeductionAmount,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 여러 개 한 번에 추가
    const insertPayloads = itemsToDeduct.map(it => ({
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty
    }));

    await window.mySupabase.from('invoice_items').insert(insertPayloads);

    closeModal('deductionModal');
    alert(`총 ${itemsToDeduct.length}개 품목에 대한 차감이 등록되었습니다.`);
    loadAdminRecentInvoices(); // 목록 갱신
};
