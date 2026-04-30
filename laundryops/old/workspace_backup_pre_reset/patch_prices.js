window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id').eq('hotel_id', hId).limit(1);
    
    if (!existItems || existItems.length === 0) {
        // 품목이 0개라면 기본단가에서 복사
        const { data: defaults } = await window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId);
        if (defaults && defaults.length > 0) {
            // "기본" 카테고리 확인/생성
            let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').single();
            if (!cat) {
                const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
                if (res.data) cat = res.data;
            }
            
            if (cat) {
                const inserts = defaults.map(d => ({
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_id: cat.id,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit
                }));
                await window.mySupabase.from('hotel_item_prices').insert(inserts);
            }
        }
    }

    // 2. 모달 열기 (일반 vs 특수)
    // [v35] 기존 구조 하위 호환: contract_type 이나 hotel_type 기준 (일반/특수)
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    if (isSpecial) {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        await window.loadHotelCategoryList();
        await window.loadHotelPriceList(); 
        openModal('priceSettingModal');
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        await window.loadSimplePriceList();
        openModal('simplePriceModal');
    }
};

// [특수거래처용 리스트]
window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: items } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('category_name').order('created_at');
    
    const tbody = document.getElementById('hotelPriceList'); // ID 수정 (simplePriceList -> hotelPriceList)
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:80px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.updateHotelItemPrice = async function(id, newPrice) {
    await window.mySupabase.from('hotel_item_prices').update({ price: Number(newPrice) || 0 }).eq('id', id);
};

// [일반거래처용 리스트 및 함수]
window.loadSimplePriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: items } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('created_at');
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }

    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    // 일반거래처의 경우 '기본' 카테고리 하나를 자동 부여
    let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').single();
    if (!cat) {
        const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
        if(res.data) cat = res.data;
    }

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        category_id: cat ? cat.id : null,
        category_name: '기본',
        name: name,
        price: price,
        unit: unit
    };

    const { error } = await window.mySupabase.from('hotel_item_prices').upsert(payload, { onConflict: 'hotel_id, name' });
    if(error) { alert('저장 에러: ' + error.message); return; }

    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
    document.getElementById('simp_name').focus();
    
    await window.loadSimplePriceList();
};

window.deleteSimpleItem = async function(id) {
    if(!confirm('삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', id);
    await window.loadSimplePriceList();
};
