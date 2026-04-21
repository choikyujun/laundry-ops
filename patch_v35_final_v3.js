// [1] 보기 팝업: 모든 항목 노출 & 수량 0 허용 & 공급가(합계)만 노출
window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type, hotel_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        alert('데이터를 찾을 수 없습니다.'); return; 
    }

    const h = inv.hotels || {};
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';
    const items = inv.invoice_items || [];
    
    // 거래처의 전체 단가표 가져오기
    const { data: allItems } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', inv.hotel_id).order('created_at');
    
    // 입력된 수량 매핑
    const getQty = (name) => {
        const found = items.find(i => i.name === name);
        return found ? found.qty : 0;
    };

    let supplyPrice = 0;
    let mergedItems = [];
    
    // 명세서에 저장된 실제 단가를 최우선으로 사용해야 함 (작성 당시 단가 보존)
    if (allItems && allItems.length > 0) {
        allItems.forEach(ai => {
            // 대소문자 구분 없이 매칭 (예: m.towel vs M.Towel)
            const invoiceItem = items.find(i => (i.name||'').toLowerCase() === (ai.name||'').toLowerCase());
            const q = invoiceItem ? Number(invoiceItem.qty) : 0;
            const priceToUse = invoiceItem ? Number(invoiceItem.price) : Number(ai.price);
            
            supplyPrice += (priceToUse * q);
            mergedItems.push({
                name: invoiceItem ? invoiceItem.name : ai.name,
                price: priceToUse,
                qty: q,
                category_name: ai.category_name || '기타'
            });
        });
        
        // 혹시 단가표에서 삭제되었지만 과거 명세서에는 존재하는 품목이 있다면 추가
        items.forEach(i => {
            const foundInAll = allItems.find(ai => (ai.name||'').toLowerCase() === (i.name||'').toLowerCase());
            if (!foundInAll) {
                const q = Number(i.qty) || 0;
                supplyPrice += (Number(i.price) * q);
                mergedItems.push({
                    name: i.name,
                    price: i.price,
                    qty: q,
                    category_name: i.category || '기타'
                });
            }
        });
    } else {
        items.forEach(i => {
            const q = Number(i.qty) || 0;
            supplyPrice += (Number(i.price) * q);
            mergedItems.push({
                name: i.name,
                price: i.price,
                qty: q,
                category_name: i.category || '기타'
            });
        });
    }
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', inv.hotel_id).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타');

        orderedCats.forEach(c => grouped[c] = []);

        mergedItems.forEach(it => {
            const cat = it.category_name || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price).toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                                <td style="padding:2px; text-align:right;">₩ ${(Number(it.price) * Number(it.qty)).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id='invoice-detail-print-area' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                    공급가(합계): ₩ ${supplyPrice.toLocaleString()}
                </div>
            </div>`;
    } else {
        reportHtml = `
            <div id='invoice-detail-print-area' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 13px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">품목명</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">단가</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">수량</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mergedItems.map(it => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${it.name}</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${Number(it.price).toLocaleString()}원</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${it.qty}</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:right;">${(Number(it.price) * Number(it.qty)).toLocaleString()}원</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; text-align:right; font-weight:700;">
                    공급가(합계): ₩ ${supplyPrice.toLocaleString()}
                </div>
            </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoice-detail-print-area')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄하기</button>
    </div>`;

    const detailArea = document.getElementById('invoiceDetailArea');
    if (detailArea) {
        detailArea.innerHTML = reportHtml;
        openModal('invoiceDetailModal');
    }
};

// [2] 저장 버튼 & 작성자(직원이름) 버그 수정
window.saveAndPrintInvoice = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    
    if(!hId || !date) { alert('거래처와 날짜를 선택해주세요.'); return; }
    
    // [Fix] currentStaffName 사용, 없으면 관리자
    let staffName = (typeof currentStaffName !== 'undefined' && currentStaffName) ? currentStaffName : (window.currentStaffName || localStorage.getItem('currentStaffName') || localStorage.getItem('staffName'));
    if (!staffName) {
        try {
            const { data: st } = await window.mySupabase.from('staff').select('name').eq('factory_id', currentFactoryId).limit(1).single();
            if (st && st.name) {
                staffName = st.name;
                localStorage.setItem('currentStaffName', staffName);
            } else {
                staffName = '현장직원';
            }
        } catch(e) { staffName = '현장직원'; }
    }

    let items = [];
    let total = 0;

    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    
    for (let row of rows) {
        if(row.cells.length < 5) continue;
        const qtyInput = row.querySelector('.qty-input');
        if(!qtyInput) continue;
        
        const q = Number(qtyInput.value) || 0;
        if(q > 0) {
            const name = row.cells[0].innerText.trim();
            const price = Number(qtyInput.dataset.price) || 0;
            const unit = row.cells[1].innerText.trim();
            items.push({ name, price, qty: q, unit });
            total += (price * q);
        }
    }

    if(items.length === 0) { alert('최소 1개 이상의 품목 수량을 입력해주세요.'); return; }

    try {
        document.getElementById('btnSaveInvoice').disabled = true;
        document.getElementById('btnSaveInvoice').innerText = '저장 중...';

        let targetInvId = window.currentEditingInvoiceId;

        if (targetInvId) {
            // Update
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
            // Insert
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

// [3] 현장직원 목록 출력 버그 수정 (이름 누락 및 삭제 버튼 없음)
window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDate = document.getElementById('staffSearchDate') ? document.getElementById('staffSearchDate').value : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`
            id, date, total_amount, is_sent, staff_name,
            hotels ( name )
        `)
        .eq('factory_id', currentFactoryId);

    if (searchDate) {
        query = query.eq('date', searchDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(30);

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">오류가 발생했습니다.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
        const statusBadge = '<span class="badge" style="background:var(--success);">발행됨</span>';

        tbody.innerHTML += `
        <tr>
            <td>${inv.date}</td>
            <td style="font-weight:700;">${hName}</td>
            <td style="text-align:right;">${inv.total_amount.toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td>${inv.staff_name || '직원'}</td>
            <td>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
            </td>
        </tr>`;
    });
};
