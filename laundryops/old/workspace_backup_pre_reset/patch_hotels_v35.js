window.loadAdminHotelList = async function() {
    const tbody = document.getElementById('adminHotelList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">거래처 목록을 불러오는 중...</td></tr>';

    const { data: hotels, error } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`; return; }
    if(!hotels || hotels.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 거래처가 없습니다.</td></tr>'; return; }

    tbody.innerHTML = '';
    hotels.forEach(h => {
        const badgeClass = h.contract_type === 'fixed' ? 'badge-fixed' : 'badge-unit';
        const badgeText = h.contract_type === 'fixed' ? '정액제' : '단가제';
        tbody.innerHTML += `<tr>
            <td><strong>${h.name}</strong></td>
            <td style="font-size:13px; color:var(--secondary);">${h.ceo || '-'}<br>${h.phone || '-'}</td>
            <td style="font-size:13px; color:var(--secondary);">${h.login_id}<br>****</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <button class="btn-mng btn-info" onclick="openHotelModal('${h.id}')">정보수정</button>
                <button class="btn-mng btn-price" onclick="openPriceSetting('${h.id}')">단가수정</button>
                <button class="btn-mng btn-del" onclick="deleteHotel('${h.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.openHotelModal = async function(hId = null) {
    window.editingHotelIdForInfo = hId;
    const modal = document.getElementById('hotelModal'),
          title = modal.querySelector('h3'),
          btn = modal.querySelector('.btn-save');

    // Clear/Reset fields
    ['h_name', 'h_ceo', 'h_phone', 'h_bizNo', 'h_address', 'h_fixedAmount', 'h_loginId', 'h_loginPw'].forEach(f => {
        const el = document.getElementById(f);
        if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
        const err = document.getElementById('err_' + f);
        if(err) err.style.display = 'none';
    });
    document.getElementById('h_contractType').value = 'unit';
    document.getElementById('h_fixedAmountGroup').style.display = 'none';
    const genRadio = document.querySelector('input[name="h_type"][value="general"]');
    if (genRadio) genRadio.checked = true;

    if (hId) {
        title.innerText = '🤝 거래처 정보 수정';
        btn.innerText = '수정 완료';
        const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
        if(h) {
            document.getElementById('h_name').value = h.name;
            document.getElementById('h_ceo').value = h.ceo || '';
            document.getElementById('h_phone').value = h.phone || '';
            document.getElementById('h_bizNo').value = h.biz_no || '';
            document.getElementById('h_address').value = h.address || '';
            document.getElementById('h_contractType').value = h.contract_type;
            document.getElementById('h_fixedAmount').value = h.fixed_amount || '0';
            document.getElementById('h_loginId').value = h.login_id || '';
            document.getElementById('h_loginPw').value = h.login_pw || '';
            if(h.hotel_type) {
                const rb = document.querySelector(`input[name="h_type"][value="${h.hotel_type}"]`);
                if(rb) rb.checked = true;
            }
            if(typeof toggleFixedAmountField === 'function') toggleFixedAmountField();
        }
    } else {
        title.innerText = '🤝 신규 거래처 등록';
        btn.innerText = '거래처 등록';
    }
    openModal('hotelModal');
};

window.saveNewHotel = async function() {
    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red';
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)';
            if(err) err.style.display = 'none';
        }
    });

    if (!isValid) return;

    const payload = {
        factory_id: currentFactoryId,
        hotel_type: document.querySelector('input[name="h_type"]:checked').value,
        name: document.getElementById('h_name').value.trim(),
        ceo: document.getElementById('h_ceo').value.trim(),
        phone: document.getElementById('h_phone').value.trim(),
        biz_no: document.getElementById('h_bizNo').value.trim(),
        address: document.getElementById('h_address').value.trim(),
        contract_type: document.getElementById('h_contractType').value,
        fixed_amount: Number(document.getElementById('h_fixedAmount').value) || 0,
        login_id: document.getElementById('h_loginId').value.trim(),
        login_pw: document.getElementById('h_loginPw').value.trim()
    };

    if(window.editingHotelIdForInfo) {
        await window.mySupabase.from('hotels').update(payload).eq('id', window.editingHotelIdForInfo);
    } else {
        payload.id = 'h_' + Date.now();
        await window.mySupabase.from('hotels').insert([payload]);
    }
    closeModal('hotelModal');
    window.loadAdminHotelList();
};

window.deleteHotel = async function(hId) {
    if(confirm('정말 이 거래처를 삭제하시겠습니까? 관련된 명세서도 표시되지 않을 수 있습니다.')) {
        await window.mySupabase.from('hotels').delete().eq('id', hId);
        window.loadAdminHotelList();
    }
};

window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    const { data: h } = await window.mySupabase.from('hotels').select('name').eq('id', hId).single();
    if(!h) return;
    document.getElementById('targetHotelNameSpecial').innerText = h.name;
    
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
    
    openModal('priceSettingModal');
};

window.loadHotelCategoryList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    if(tagContainer) tagContainer.innerHTML = '';
    if(select) select.innerHTML = '<option value="">선택하세요</option>';
    
    let hasDefault = false;
    
    if(cats && cats.length > 0) {
        cats.forEach(c => {
            if(c.name === '기타') hasDefault = true;
            if(tagContainer) {
                tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} ${c.name !== '기타' ? `<button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>` : ''}
                </span>`;
            }
            if(select) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
    }
    
    // 만약 카테고리가 아예 없거나 기본 '기타' 카테고리가 없다면 추가
    if(!hasDefault) {
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기타' }]);
        const { data: newCats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
        if(newCats) {
            if(tagContainer) tagContainer.innerHTML = '';
            if(select) select.innerHTML = '<option value="">선택하세요</option>';
            newCats.forEach(c => {
                if(tagContainer) {
                    tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                        ${c.name} ${c.name !== '기타' ? `<button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>` : ''}
                    </span>`;
                }
                if(select) select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    }
};

window.addHotelCategory = async function() {
    const input = document.getElementById('new_h_cat_name');
    const catName = input.value.trim();
    if(!catName) return;
    const hId = window.editingHotelIdForPrice;
    
    const { data: exist } = await window.mySupabase.from('hotel_categories').select('id').eq('hotel_id', hId).eq('name', catName).single();
    if(exist) { alert('이미 존재하는 카테고리입니다.'); return; }
    
    await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: catName }]);
    input.value = '';
    await window.loadHotelCategoryList();
};

window.deleteHotelCategory = async function(catId) {
    if(!confirm('삭제하시겠습니까? 이 카테고리에 속한 품목도 모두 함께 삭제됩니다.')) return;
    await window.mySupabase.from('hotel_categories').delete().eq('id', catId);
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
};

window.addHotelCustomItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    const catId = document.getElementById('hp_cat').value;
    
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    if(!catId) { alert('카테고리를 선택해주세요.'); return; }
    
    const selectEl = document.getElementById('hp_cat');
    const catOption = selectEl.options[selectEl.selectedIndex].text;
    
    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        category_id: catId,
        category_name: catOption,
        name: name,
        price: price,
        unit: unit
    };
    
    // ON CONFLICT 구문을 위해 name 과 hotel_id 로 유니크 처리
    const { error } = await window.mySupabase.from('hotel_item_prices').upsert(payload, { onConflict: 'hotel_id, name' });
    if(error) { alert('저장 에러: ' + error.message); console.error(error); return; }
    
    await window.loadHotelPriceList();
    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
    document.getElementById('hp_name').focus();
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    const { data: items } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('category_name').order('created_at');
    
    const tbody = document.getElementById('simplePriceList');
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
            <td>${it.price.toLocaleString()}원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteHotelPrice = async function(itemId) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', itemId);
    await window.loadHotelPriceList();
};
