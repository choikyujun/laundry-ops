
window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId; 
    
    const { data: h } = await window.mySupabase.from("hotels").select("*").eq("id", hId).single();
    if(!h) return;
    
    if(h.contract_type === "fixed") { alert("월정액 거래처의 단가는 매출에 적용되지 않습니다!"); }
    
    const { data: existItems } = await window.mySupabase.from("hotel_item_prices").select("id, name, sort_order").eq("hotel_id", hId).limit(10);
    const { data: defaults } = await window.mySupabase.from("factory_default_prices").select("*").eq("factory_id", currentFactoryId).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        let { data: cat } = await window.mySupabase.from("hotel_categories").select("*").eq("hotel_id", hId).eq("name", "기본").maybeSingle();
        if (!cat) { const res = await window.mySupabase.from("hotel_categories").insert([{ factory_id: currentFactoryId, hotel_id: hId, category_name: "기타", name: "기본" }]).select().single(); if(res.data) cat = res.data; }
        if (cat) { for (let i = 0; i < defaults.length; i++) { const d = defaults[i]; await window.mySupabase.from("hotel_item_prices").insert([{ factory_id: currentFactoryId, hotel_id: hId, category_id: cat.id, category_name: "기타", name: d.name, price: d.price, unit: d.unit, sort_order: i }]); } }
    }
    
    const isSpecial = h.hotel_type === "special" || h.contract_type === "special";
    if (isSpecial) { 
        document.getElementById("targetHotelNameSpecial").innerText = h.name; 
        await window.loadHotelCategoryList(); 
        await window.loadHotelPriceList(); 
        openModal("priceSettingModal"); 
    } else { 
        document.getElementById("targetHotelNameSimple").innerText = h.name; 
        await window.loadSimplePriceList(); 
        openModal("simplePriceModal"); 
    }
};

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    let { data: maxData } = await window.mySupabase.from('hotel_item_prices').select('sort_order').eq('hotel_id', hId).order('sort_order', { ascending: false }).limit(1);
    let nextOrder = 1;
    if(maxData && maxData.length > 0 && maxData[0].sort_order != null) nextOrder = maxData[0].sort_order + 1;
    const payload = { factory_id: currentFactoryId, hotel_id: hId, category_name: '기타', name: name, price: price, unit: unit, sort_order: nextOrder };
    const { error } = await window.mySupabase.from('hotel_item_prices').insert([payload]);
    if(error) alert('추가 실패: ' + error.message);
    else { document.getElementById('simp_name').value = ''; document.getElementById('simp_price').value = '0'; await window.loadSimplePriceList(); }
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const catId = document.getElementById('hp_cat').value;
    
    let query = window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name, category_id')
        .eq('hotel_id', hId);
        
    if(catId && catId !== 'all') {
        query = query.eq('category_id', catId);
    }
    
    const { data: items } = await query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
        
    const tbody = document.getElementById('hotelPriceList');
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
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:80px; padding:5px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteHotelCategory = async function(catId) {
    if(!confirm('정말 삭제하시겠습니까? (해당 카테고리의 품목들도 함께 삭제됩니다)')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('category_id', catId);
    await window.mySupabase.from('hotel_categories').delete().eq('id', catId);
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
};

window.loadHotelCategoryList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    if(tagContainer) tagContainer.innerHTML = '';
    if(select) select.innerHTML = '<option value="all">전체</option>';
    
    if(cats && cats.length > 0) {
        cats.forEach(c => {
            if(tagContainer) {
                tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} <button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>
                </span>`;
            }
            if(select) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
    }
};
