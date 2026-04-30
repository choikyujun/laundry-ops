
// Patch: Add warning for fixed-contract hotel price updates
window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId; 
    
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;

    // [Task] Fixed contract warning
    if (h.contract_type === 'fixed') {
        alert("월정액 거래처의 단가는 매출 합계에 반영되지 않습니다!");
    }
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id, name, sort_order').eq('hotel_id', hId).limit(10);
    
    // 2. 품목이 0개라면 공장 기본단가에서 복사
    const { data: defaults } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        // "기본" 카테고리 확인/생성
        let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        if (!cat) {
            const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
            cat = res.data;
        }
        
        if (cat) {
            const inserts = defaults.map((d, i) => ({
                factory_id: currentFactoryId,
                hotel_id: hId,
                category_id: cat.id,
                category_name: cat.name,
                name: d.name,
                price: d.price,
                unit: d.unit,
                sort_order: i
            }));
            await window.mySupabase.from('hotel_item_prices').insert(inserts);
        }
    }

    if (h.contract_type === 'special' || h.hotelType === 'special') {
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
