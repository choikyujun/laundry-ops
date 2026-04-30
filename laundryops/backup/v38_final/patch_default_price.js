window.loadAdminDefaultPriceList = async function() {
    const tbody = document.getElementById('adminDefaultPriceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기본 품목을 불러오는 중...</td></tr>';

    const { data: items, error } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('created_at');

    if(error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">조회 에러: ${error.message}</td></tr>`;
        return;
    }

    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">등록된 기본 품목이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
        tbody.innerHTML += `
        <tr style="height:35px;">
            <td style="padding:4px 8px;">${item.name}</td>
            <td style="padding:4px 8px;">${item.price.toLocaleString()}원</td>
            <td style="padding:4px 8px;">${item.unit}</td>
            <td style="padding:4px 8px;">
                <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice('${item.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.saveDefaultPrice = async function() {
    const nameEl = document.getElementById('dp_name');
    const priceEl = document.getElementById('dp_price');
    const unitEl = document.getElementById('dp_unit');

    const name = nameEl.value.trim();
    const price = Number(priceEl.value) || 0;
    const unit = unitEl.value.trim() || '개';

    if(!name) { alert('품목명을 입력해주세요.'); return; }

    const payload = {
        factory_id: currentFactoryId,
        name: name,
        price: price,
        unit: unit
    };

    const { error } = await window.mySupabase.from('factory_default_prices')
        .upsert(payload, { onConflict: 'factory_id, name' });

    if(error) {
        alert('저장에 실패했습니다: ' + error.message);
        return;
    }

    // 입력창 초기화 및 목록 갱신
    nameEl.value = '';
    priceEl.value = '0';
    unitEl.value = '개';
    nameEl.focus();
    
    await window.loadAdminDefaultPriceList();
};

window.deleteDefaultPrice = async function(id) {
    if(!confirm('해당 기본 품목을 삭제하시겠습니까?')) return;

    const { error } = await window.mySupabase.from('factory_default_prices')
        .delete()
        .eq('id', id);

    if(error) {
        alert('삭제에 실패했습니다: ' + error.message);
        return;
    }

    await window.loadAdminDefaultPriceList();
};

window.openDefaultPriceSetting = function() { 
    openModal('defaultPriceModal'); 
    window.loadAdminDefaultPriceList(); 
};
