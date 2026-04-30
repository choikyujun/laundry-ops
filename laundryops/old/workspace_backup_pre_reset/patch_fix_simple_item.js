
window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    // 1. Get current max sort_order
    const { data: maxItem } = await window.mySupabase.from('hotel_item_prices')
        .select('sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    const newSortOrder = (maxItem && maxItem.sort_order !== null) ? maxItem.sort_order + 1 : 1;

    // 2. 카테고리 정보 확인
    let { data: cat } = await window.mySupabase.from('hotel_categories')
        .select('id, name')
        .eq('hotel_id', hId)
        .eq('name', '기타')
        .maybeSingle();
    
    if (!cat) {
        const { data: anyCat } = await window.mySupabase.from('hotel_categories')
            .select('id, name')
            .eq('hotel_id', hId)
            .limit(1)
            .maybeSingle();
            
        if (anyCat) {
            cat = anyCat;
        } else {
            const { data: newCat } = await window.mySupabase.from('hotel_categories')
                .insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기타' }])
                .select('id, name')
                .single();
            cat = newCat;
        }
    }

    // 3. 페이로드 구성 (sort_order 추가)
    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit,
        sort_order: newSortOrder,
        category_id: cat ? cat.id : null,
        category_name: (cat && cat.name) ? cat.name : '기타'
    };
    
    console.log("DEBUG: Final Payload with sort_order:", JSON.stringify(payload));
    
    const { data: inserted, error: insertError } = await window.mySupabase.from('hotel_item_prices').insert([payload]);
    
    if (insertError) {
        console.error("DEBUG: Insert failed:", insertError);
        alert('품목 추가 실패: ' + insertError.message);
        return;
    }
    
    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
    await window.loadSimplePriceList();
};
