
// === ADDING MISSING PRICE FUNCTIONS ===

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    if (!currentFactoryId) currentFactoryId = localStorage.getItem('currentFactoryId');
    if (!currentFactoryId) { alert("로그인 세션이 만료되었습니다."); return; }
    
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    let { data: maxData } = await window.mySupabase.from('hotel_item_prices')
        .select('sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: false })
        .limit(1);
        
    let nextOrder = 1;
    if(maxData && maxData.length > 0 && maxData[0].sort_order !== null) {
        nextOrder = maxData[0].sort_order + 1;
    }

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit,
        category_name: '기타',
        sort_order: nextOrder
    };

    const { error } = await window.mySupabase.from('hotel_item_prices')
        .upsert(payload, { onConflict: 'hotel_id, name' });

    if(error) {
        alert('품목 추가 실패: ' + error.message);
    } else {
        document.getElementById('simp_name').value = '';
        document.getElementById('simp_price').value = '0';
        document.getElementById('simp_unit').value = '개';
        window.loadSimplePriceList();
    }
};

window.addHotelCustomItem = async function() {
    const hId = window.editingHotelIdForPrice;
    if (!currentFactoryId) currentFactoryId = localStorage.getItem('currentFactoryId');
    if (!currentFactoryId) return;

    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    const catId = document.getElementById('hp_cat').value;
    
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    if(!catId) { alert('카테고리를 선택해주세요.'); return; }
    
    const selectEl = document.getElementById('hp_cat');
    const catOption = selectEl.options[selectEl.selectedIndex].text;
    
    let { data: maxData } = await window.mySupabase.from('hotel_item_prices')
        .select('sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: false })
        .limit(1);
        
    let nextOrder = 1;
    if(maxData && maxData.length > 0 && maxData[0].sort_order !== null) {
        nextOrder = maxData[0].sort_order + 1;
    }

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        category_id: catId,
        category_name: catOption,
        name: name,
        price: price,
        unit: unit,
        sort_order: nextOrder
    };
    
    const { error } = await window.mySupabase.from('hotel_item_prices').upsert(payload, { onConflict: 'hotel_id, name' });
    if(error) { alert('저장 에러: ' + error.message); console.error(error); return; }
    
    await window.loadHotelPriceList();
    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
};
