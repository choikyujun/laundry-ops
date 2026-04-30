window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if(!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    const noticeArea = document.getElementById('contractNoticeArea');
    if (noticeArea) {
        if (hData.contract_type === 'fixed') {
            noticeArea.innerHTML = `⚠️ 이 거래처는 월 정액제입니다. (계약 금액: ${Number(hData.fixed_amount||0).toLocaleString()}원)`;
            noticeArea.style.display = 'block';
        } else {
            noticeArea.style.display = 'none';
        }
    }

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    const isSpecial = hData.hotel_type === 'special' || hData.contract_type === 'special';

    // v35: hotel_item_prices 에서 조회
    let { data: itemsToRender } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('created_at');
    
    // 만약 품목이 없으면 factory_default_prices 에서 대체로 가져오기
    if (!itemsToRender || itemsToRender.length === 0) {
        const { data: fData } = await window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId).order('created_at');
        if(fData) itemsToRender = fData;
    }

    tbody.innerHTML = '';
    
    if (isSpecial && itemsToRender && itemsToRender.length > 0) {
        // 특수거래처 양식: 카테고리별로 그룹화 (등록된 카테고리 순서대로)
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
        
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타'); // fallback

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
                    tbody.innerHTML += `
                    <tr data-category="${cat}">
                        <td>${item.name}</td>
                        <td>${unit}</td>
                        <td class="item-price" data-price="${item.price}">${Number(item.price).toLocaleString()}원</td>
                        <td><input type="number" class="inv-qty qty-input" value="0" min="0" oninput="calcTotal()" onkeydown="handleQtyKeydown(event)" style="width:60px; padding:5px; text-align:center;" data-price="${item.price}"></td>
                        <td class="item-amount">0원</td>
                    </tr>`;
                });
            }
        });
    } else {
        // 일반거래처 양식 (등록된 순서대로)
        if (itemsToRender) {
            itemsToRender.forEach(item => {
                const unit = item.unit || '개';
                tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${unit}</td>
                    <td class="item-price" data-price="${item.price}">${Number(item.price).toLocaleString()}원</td>
                    <td><input type="number" class="inv-qty qty-input" value="0" min="0" oninput="calcTotal()" onkeydown="handleQtyKeydown(event)" style="width:60px; padding:5px; text-align:center;" data-price="${item.price}"></td>
                    <td class="item-amount">0원</td>
                </tr>`;
            });
        }
    }

    if(typeof window.calcTotal === 'function') window.calcTotal();
};

window.calcTotal = function() {
    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    let total = 0;
    rows.forEach(row => {
        if(row.cells.length < 5) return;
        const qtyInput = row.querySelector('.qty-input');
        if(!qtyInput) return;

        const price = Number(qtyInput.dataset.price) || 0;
        const qty = Number(qtyInput.value) || 0;
        const sub = price * qty;

        row.querySelector('.item-amount').innerText = sub.toLocaleString() + '원';
        total += sub;
    });
    
    const el = document.getElementById('invoiceTotalAmount');
    if(el) el.innerText = total.toLocaleString() + '원';
};

// [버그 수정] 저장하기 버튼 먹통 (기존 함수명 saveAndPrintInvoice 와 매칭)
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
            const category = row.dataset.category || null;
            
            items.push({ name, price, qty: q, unit, category });
            total += (price * q);
        }
    });

    if(items.length === 0) { alert('최소 1개 이상의 품목 수량을 입력해주세요.'); return; }

    try {
        document.getElementById('btnSaveInvoice').disabled = true;
        document.getElementById('btnSaveInvoice').innerText = '저장 중...';

        const { data: invData, error: invErr } = await window.mySupabase.from('invoices').insert([{
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: total,
            staff_name: staffName,
            items: items, // JSON
            is_sent: false
        }]).select().single();

        if (invErr) throw invErr;

        if (invData && invData.id) {
            const itemInserts = items.map(it => ({
                invoice_id: invData.id,
                name: it.name,
                price: it.price,
                qty: it.qty,
                unit: it.unit,
                category: it.category
            }));
            await window.mySupabase.from('invoice_items').insert(itemInserts);
        }

        alert('거래명세서가 저장되었습니다!');
        
        // 입력창 초기화
        document.querySelectorAll('.qty-input').forEach(el => el.value = 0);
        window.calcTotal();

        // 관리자 대시보드 새로고침 (옵션)
        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        
    } catch (err) {
        alert('저장 실패: ' + err.message);
    } finally {
        document.getElementById('btnSaveInvoice').disabled = false;
        document.getElementById('btnSaveInvoice').innerText = '저장하기';
    }
};
