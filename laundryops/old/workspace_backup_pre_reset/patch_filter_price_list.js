
window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: items } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name, category_id')
        .eq('hotel_id', hId)
        .order('category_name', { ascending: true }) // Category first
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    const tbody = document.getElementById('hotelPriceList');
    const catFilter = document.getElementById('hp_cat').value; // Get filter value
    
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        // [Task 1] Filter by category_id if selected
        if (catFilter && catFilter !== '' && String(it.category_id) !== String(catFilter)) {
            return; // Skip if it doesn't match
        }

        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name || '기타'}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:80px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};
