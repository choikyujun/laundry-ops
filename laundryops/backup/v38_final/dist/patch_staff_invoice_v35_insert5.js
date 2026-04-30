window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if(!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    // 2. 해당 날짜 데이터 존재 여부 확인 및 수정 여부 묻기 (category 제외하고 select)
    const { data: existInv } = await window.mySupabase.from('invoices')
        .select('id, invoice_items(name, qty)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let existingData = null;
    if (existInv) {
        if (!confirm('해당 날짜에 이미 작성된 명세서가 있습니다. 기존 내역을 불러와서 수정하시겠습니까?')) {
            // 아니오 선택 시 초기화
            document.getElementById('staffHotelSelect').value = '';
            document.getElementById('invoiceFormArea').style.display = 'none';
            return;
        }
        existingData = existInv;
    }

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    if (existingData) {
        window.currentEditingInvoiceId = existingData.id;
    } else {
        window.currentEditingInvoiceId = null;
    }

    const noticeArea = document.getElementById('contractNoticeArea');
    if (noticeArea) {
        if (hData.contract_type === 'fixed') {
            noticeArea.innerHTML = `⚠️ 이 거래처는 월 정액제입니다. (계약 금액: ${Number(hData.fixed_amount||0).toLocaleString()}원)`;
            noticeArea.style.display = 'block';
        } else {
            noticeArea.style.display = 'none';
        }
    }
    
    const badge = document.getElementById('editModeBadge');
    if(badge) badge.style.display = existingData ? 'block' : 'none';

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    const isSpecial = hData.hotel_type === 'special' || hData.contract_type === 'special';

    let { data: itemsToRender } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('created_at');
    
    if (!itemsToRender || itemsToRender.length === 0) {
        const { data: fData } = await window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId).order('created_at');
        if(fData) itemsToRender = fData;
    }

    tbody.innerHTML = '';
    
    const getQty = (itemName) => {
        if(!existingData || !existingData.invoice_items) return 0;
        const found = existingData.invoice_items.find(i => i.name === itemName);
        return found ? found.qty : 0;
    };

    if (isSpecial && itemsToRender && itemsToRender.length > 0) {
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
        
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);

        itemsToRender.forEach(item => {
            const cat = item.category_name || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });

        orderedCats.forEach(cat => {
            if(grouped[cat] && grouped[cat].length > 0) {
                tbody.innerHTML += `<tr style="background:#f1f5f9;"><td colspan="5" style="padding:10px; font-weight:700; color:#334155;">📁 ${cat}</td></tr>`;
                grouped[cat].forEach(item => {
                    const unit = item.unit || '개';
                    const q = getQty(item.name);
                    tbody.innerHTML += `
                    <tr data-category="${cat}">
                        <td>${item.name}</td>
                        <td>${unit}</td>
                        <td class="item-price" data-price="${item.price}">${Number(item.price).toLocaleString()}원</td>
                        <td><input type="number" class="inv-qty qty-input" value="${q}" min="0" oninput="calcTotal()" onkeydown="handleQtyKeydown(event)" style="width:60px; padding:5px; text-align:center;" data-price="${item.price}"></td>
                        <td class="item-amount">0원</td>
                    </tr>`;
                });
            }
        });
    } else {
        if (itemsToRender) {
            itemsToRender.forEach(item => {
                const unit = item.unit || '개';
                const q = getQty(item.name);
                tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${unit}</td>
                    <td class="item-price" data-price="${item.price}">${Number(item.price).toLocaleString()}원</td>
                    <td><input type="number" class="inv-qty qty-input" value="${q}" min="0" oninput="calcTotal()" onkeydown="handleQtyKeydown(event)" style="width:60px; padding:5px; text-align:center;" data-price="${item.price}"></td>
                    <td class="item-amount">0원</td>
                </tr>`;
            });
        }
    }

    if(typeof window.calcTotal === 'function') window.calcTotal();
};

window.saveAndPrintInvoice = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    
    if(!hId || !date) { alert('거래처와 날짜를 선택해주세요.'); return; }
    
    const staffName = localStorage.getItem('staffName') || '관리자';

    let items = [];
    let total = 0;

    document.querySelectorAll('#staffInvoiceBody tr').forEach(row => {
        if(row.cells.length < 5) return;
        const qtyInput = row.querySelector('.qty-input');
        if(!qtyInput) return;
        
        const q = Number(qtyInput.value);
        if(q > 0) {
            const name = row.cells[0].innerText;
            const price = Number(qtyInput.dataset.price) || 0;
            const unit = row.cells[1].innerText;
            // DB에 category 넣지 않기 (에러 방지)
            
            items.push({ name, price, qty: q, unit });
            total += (price * q);
        }
    });

    if(items.length === 0) { alert('최소 1개 이상의 품목 수량을 입력해주세요.'); return; }

    try {
        document.getElementById('btnSaveInvoice').disabled = true;
        document.getElementById('btnSaveInvoice').innerText = '저장 중...';

        let targetInvId = window.currentEditingInvoiceId;

        if (targetInvId) {
            await window.mySupabase.from('invoices').update({
                total_amount: total,
                staff_name: staffName,
                updated_at: new Date().toISOString()
            }).eq('id', targetInvId);

            await window.mySupabase.from('invoice_items').delete().eq('invoice_id', targetInvId);

            const itemInserts = items.map(it => ({
                id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('item_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                invoice_id: targetInvId,
                name: it.name,
                price: it.price,
                qty: it.qty,
                unit: it.unit
            }));
            await window.mySupabase.from('invoice_items').insert(itemInserts);

            alert('명세서가 수정되었습니다!');
        } else {
            const newInvId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('inv_' + Date.now() + Math.random().toString(36).substr(2, 9));

            const { data: invData, error: invErr } = await window.mySupabase.from('invoices').insert([{
                id: newInvId,
                factory_id: currentFactoryId,
                hotel_id: hId,
                date: date,
                total_amount: total,
                staff_name: staffName,
                is_sent: false
            }]).select().single();

            if (invErr) throw invErr;

            if (invData && invData.id) {
                const itemInserts = items.map(it => ({
                    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('item_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                    invoice_id: invData.id,
                    name: it.name,
                    price: it.price,
                    qty: it.qty,
                    unit: it.unit
                }));
                await window.mySupabase.from('invoice_items').insert(itemInserts);
            }

            alert('거래명세서가 저장되었습니다!');
        }
        
        window.currentEditingInvoiceId = null;

        document.getElementById('invoiceFormArea').style.display = 'none';
        const selectEl = document.getElementById('staffHotelSelect');
        if (selectEl) {
            selectEl.value = '';
            selectEl.focus(); 
        }

        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        
    } catch (err) {
        alert('저장 실패: ' + err.message);
    } finally {
        document.getElementById('btnSaveInvoice').disabled = false;
        document.getElementById('btnSaveInvoice').innerText = '저장하기';
    }
};
