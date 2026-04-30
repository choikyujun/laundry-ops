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
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { 
                            event.preventDefault(); 
                            const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); 
                            const idx = inputs.indexOf(this); 
                            if(idx > -1 && idx < inputs.length - 1) {
                                inputs[idx+1].focus(); 
                            } else {
                                document.getElementById('btnSaveDeduction').focus();
                            }
                        }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};
