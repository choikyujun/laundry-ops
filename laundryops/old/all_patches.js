window.openDeductionModal = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    document.getElementById('deductHotelName').innerText = hotelFilter.options[hotelFilter.selectedIndex].text;
    document.getElementById('deductHotelId').value = hotelFilter.value;
    document.getElementById('deductDate').value = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    document.getElementById('deductItemName').value = '[월말 클레임/재탕 정산]';
    document.getElementById('deductPrice').value = '-10000';
    document.getElementById('deductQty').value = '1';
    openModal('deductionModal');
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    const itemName = document.getElementById('deductItemName').value.trim();
    const price = Number(document.getElementById('deductPrice').value);
    const qty = Number(document.getElementById('deductQty').value);

    if (!hId || !date || !itemName || qty === 0) return;

    const itemTotal = price * qty;
    
    // 1. 기존 명세서 확인
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        // 기존 아이템 놔두고 추가만 함 (원래 로직은 덮어쓰기지만, 차감은 기존 항목 유지)
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + itemTotal })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: itemTotal,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 추가
    await window.mySupabase.from('invoice_items').insert([{
        invoice_id: invoiceId,
        name: itemName,
        price: price,
        qty: qty
    }]);

    closeModal('deductionModal');
    alert('차감 내역이 성공적으로 등록되었습니다.');
    loadAdminRecentInvoices(); // 목록 갱신
};
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    document.getElementById('deductDate').value = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    
    // 거래처의 단가표(품목 목록) 불러오기
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const itemSelect = document.getElementById('deductItemSelect');
    itemSelect.innerHTML = '<option value="">품목을 선택하세요 (단가표 기준)</option>';
    
    if (prices && prices.length > 0) {
        prices.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.dataset.price = p.price;
            opt.innerText = `${p.name} (${p.price}원 / ${p.unit || '장'})`;
            itemSelect.appendChild(opt);
        });
    } else {
        itemSelect.innerHTML += '<option value="" disabled>등록된 품목이 없습니다.</option>';
    }
    
    document.getElementById('deductPrice').value = '0';
    document.getElementById('deductQty').value = '-1';
    
    openModal('deductionModal');
};

window.handleDeductItemChange = function() {
    const itemSelect = document.getElementById('deductItemSelect');
    const selected = itemSelect.options[itemSelect.selectedIndex];
    if (selected && selected.dataset.price) {
        document.getElementById('deductPrice').value = selected.dataset.price;
    } else {
        document.getElementById('deductPrice').value = '0';
    }
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    const itemSelect = document.getElementById('deductItemSelect');
    const itemName = itemSelect.value;
    const price = Number(document.getElementById('deductPrice').value);
    const qty = Number(document.getElementById('deductQty').value);

    if (!hId || !date || !itemName) {
        alert('날짜와 품목을 모두 선택해주세요.');
        return;
    }
    
    if (qty === 0 || qty > 0) {
        alert('차감 수량은 반드시 마이너스(-) 값이어야 합니다. 예: -5');
        return;
    }

    const itemTotal = price * qty; // 예: 500원 * -5 = -2500원
    
    // 1. 기존 명세서 확인
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        // 총액 업데이트
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + itemTotal })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: itemTotal,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 추가 (차감 명목임을 명시하기 위해 이름에 '[클레임/차감]' 등 태그를 붙일지 물어볼 수도 있지만,
    // 사장님 요청은 "어떤 품목에서 - 수량을 입력해서 적용됐는지가 중요해" 이므로 원본 품목명을 그대로 쓰고 수량만 마이너스로 함.
    // 혹시 구분을 위해 "품목명 (차감)" 형태로 넣으면 통계나 명세서 리스트에 명확하게 나옴.
    await window.mySupabase.from('invoice_items').insert([{
        invoice_id: invoiceId,
        name: itemName + ' (클레임차감)',
        price: price,
        qty: qty
    }]);

    closeModal('deductionModal');
    alert(`[${itemName}] ${qty}개 차감 내역이 성공적으로 등록되었습니다.`);
    loadAdminRecentInvoices(); // 목록 갱신
};
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    document.getElementById('deductDate').value = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    
    // 거래처의 단가표(품목 목록) 불러오기
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${p.price}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="number" class="deduct-qty-input" data-name="${p.name}" placeholder="0" style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('deductDate').value;
    
    if (!hId || !date) {
        alert('날짜를 선택해주세요.');
        return;
    }

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value);
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        } else if (qty > 0) {
            alert(`[${input.getAttribute('data-name')}] 차감 수량은 반드시 마이너스(-) 값이어야 합니다.`);
            throw new Error('Positive quantity not allowed in deduction');
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 마이너스(-) 기호와 함께 입력해주세요. (예: -5)');
        return;
    }

    const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    // 1. 기존 명세서 확인
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + totalDeductionAmount })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalDeductionAmount,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 여러 개 한 번에 추가
    const insertPayloads = itemsToDeduct.map(it => ({
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty
    }));

    await window.mySupabase.from('invoice_items').insert(insertPayloads);

    closeModal('deductionModal');
    alert(`총 ${itemsToDeduct.length}개 품목에 대한 차감이 등록되었습니다.`);
    loadAdminRecentInvoices(); // 목록 갱신
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            // 차감 태그 제거하고 원본 이름으로 합산
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            // 차감 수량 계산 (음수인 것만 합산)
                            const negQty = dateSequence.reduce((s, d) => {
                                const val = (dailyData[d] && dailyData[d][it.name]) || 0;
                                return s + (val < 0 ? val : 0);
                            }, 0);
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${negQty !== 0 ? negQty : ''}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.qty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.qty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        // 해당 날짜에 데이터가 있는지 확인
                        const hasData = itemNames.some(name => dailyData[d] && dailyData[d][name] !== undefined);
                        if (!hasData) return ''; // 빈 날짜는 출력 안 할 수도 있지만 기존 로직 유지 (기존에는 다 출력함)
                        
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                const val = (dailyData[d] && dailyData[d][name]) || 0;
                                return sum + (val < 0 ? val : 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty !== 0 ? negQty : ''}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    openModal('sendInvoiceModal');
};
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    // 거래처의 단가표(품목 목록) 불러오기
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    // 날짜는 현재 조회 필터의 '종료일'로 자동 지정 (해당 기간의 마지막 날짜에 차감 내역 귀속)
    const date = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    
    if (!hId) return;

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value); // '-5' -> -5
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 입력해주세요.');
        return;
    }

    const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    // 1. 기존 명세서 확인 (선택한 기간의 마지막 날짜(date)에 병합)
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + totalDeductionAmount })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalDeductionAmount,
            author: '관리자(차감)'
        }]);
    }

    // 아이템 여러 개 한 번에 추가
    const insertPayloads = itemsToDeduct.map(it => ({
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty
    }));

    await window.mySupabase.from('invoice_items').insert(insertPayloads);

    closeModal('deductionModal');
    alert(`조회 기간 마지막 날짜(${date}) 기준으로 총 ${itemsToDeduct.length}개 품목에 대한 차감이 등록되었습니다.`);
    loadAdminRecentInvoices(); // 목록 갱신
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            // 차감 태그 제거하고 원본 이름으로 합산
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            const negQty = dateSequence.reduce((s, d) => {
                                const val = (dailyData[d] && dailyData[d][it.name]) || 0;
                                return s + (val < 0 ? val : 0);
                            }, 0);
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${negQty !== 0 ? negQty : ''}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.qty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.qty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        // 수정: hasData 체크를 없애고 모든 날짜를 무조건 렌더링하도록 변경
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                const val = (dailyData[d] && dailyData[d][name]) || 0;
                                return sum + (val < 0 ? val : 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty !== 0 ? negQty : ''}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    openModal('sendInvoiceModal');
};
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    // 거래처의 단가표(품목 목록) 불러오기
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { event.preventDefault(); const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); const idx = inputs.indexOf(this); if(idx > -1 && idx < inputs.length - 1) inputs[idx+1].focus(); }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};
    let globalHasDeduction = false; // 차감 유무 플래그

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) globalHasDeduction = true; // 음수 수량이 하나라도 있으면 차감 발생으로 간주
            
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            const negQty = dateSequence.reduce((s, d) => {
                                const val = (dailyData[d] && dailyData[d][it.name]) || 0;
                                return s + (val < 0 ? val : 0);
                            }, 0);
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${negQty !== 0 ? negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.qty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.qty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                const val = (dailyData[d] && dailyData[d][name]) || 0;
                                return sum + (val < 0 ? val : 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty !== 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    openModal('sendInvoiceModal');
};
window.saveDeduction = async function() {
    const hId = document.getElementById('deductHotelId').value;
    const date = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
    
    if (!hId) return;

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value); 
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 입력해주세요.');
        return;
    }

    const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        await window.mySupabase.from('invoices')
            .update({ total_amount: Number(existing.total_amount) + totalDeductionAmount })
            .eq('id', invoiceId);
    } else {
        invoiceId = 'inv_' + Date.now();
        await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalDeductionAmount,
            author: '관리자(차감)'
        }]);
    }

    const insertPayloads = itemsToDeduct.map(it => ({
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty
    }));

    await window.mySupabase.from('invoice_items').insert(insertPayloads);

    closeModal('deductionModal');
    loadAdminRecentInvoices(); 
    window.sendInvoicesToClient(); // 2안: 팝업을 즉시 새로고침하여 적용된 내역을 보여줌
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            if (it.qty < 0) globalHasDeduction = true; 
            
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            const negQty = dateSequence.reduce((s, d) => {
                                const val = (dailyData[d] && dailyData[d][it.name]) || 0;
                                return s + (val < 0 ? val : 0);
                            }, 0);
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${negQty !== 0 ? negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.qty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.qty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                const val = (dailyData[d] && dailyData[d][name]) || 0;
                                return sum + (val < 0 ? val : 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty !== 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    openModal('sendInvoiceModal');
};
window.saveDeduction = async function() {
    try {
        const hId = document.getElementById('deductHotelId').value;
        const date = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
        
        if (!hId) return;

        const itemsToDeduct = [];
        document.querySelectorAll('.deduct-qty-input').forEach(input => {
            const qty = Number(input.value); 
            if (qty < 0) {
                const name = input.getAttribute('data-name');
                const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
                itemsToDeduct.push({ name: name + ' (차감)', price, qty });
            }
        });

        if (itemsToDeduct.length === 0) {
            alert('차감할 수량을 입력해주세요.');
            return;
        }

        const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // 여러 개가 있을 수 있으므로 limit(1)
        const { data: existingList } = await window.mySupabase
            .from('invoices').select('id, total_amount')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hId)
            .eq('date', date)
            .limit(1);

        let invoiceId;
        if (existingList && existingList.length > 0) {
            invoiceId = existingList[0].id;
            await window.mySupabase.from('invoices')
                .update({ total_amount: Number(existingList[0].total_amount) + totalDeductionAmount })
                .eq('id', invoiceId);
        } else {
            invoiceId = 'inv_' + Date.now();
            await window.mySupabase.from('invoices').insert([{
                id: invoiceId,
                factory_id: currentFactoryId,
                hotel_id: hId,
                date: date,
                total_amount: totalDeductionAmount,
                author: '관리자(차감)'
            }]);
        }

        const insertPayloads = itemsToDeduct.map(it => ({
            invoice_id: invoiceId,
            name: it.name,
            price: it.price,
            qty: it.qty
        }));

        const { error: insErr } = await window.mySupabase.from('invoice_items').insert(insertPayloads);
        if(insErr) throw new Error(insErr.message);

        closeModal('deductionModal');
        
        // 시각적 피드백
        alert('월말 차감이 성공적으로 적용되었습니다.');
        
        if (typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices(); 
        await window.sendInvoicesToClient(); 
    } catch (e) {
        console.error(e);
        alert('저장 중 오류 발생: ' + e.message);
    }
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; // 차감만 따로 기록! (버그 원인 해결)
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            const negQty = dateSequence.reduce((s, d) => {
                                return s + ((negativeDailyData[d] && negativeDailyData[d][it.name]) || 0);
                            }, 0);
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${negQty < 0 ? negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.qty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.qty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const negVal = (negativeDailyData[d] && negativeDailyData[d][name]) || 0;
                                const colorStr = negVal < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    // 이전에 모달이 열려있지 않았다면 열기
    openModal('sendInvoiceModal');
};
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { 
                            event.preventDefault(); 
                            const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); 
                            const idx = inputs.indexOf(this); 
                            if(idx > -1 && idx < inputs.length - 1) {
                                inputs[idx+1].focus(); 
                            } else {
                                document.getElementById('btnSaveDeduction').focus();
                            }
                        }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};
window.saveDeduction = async function() {
    try {
        const hId = document.getElementById('deductHotelId').value;
        const date = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
        
        if (!hId) return;

        const itemsToDeduct = [];
        document.querySelectorAll('.deduct-qty-input').forEach(input => {
            const qty = Number(input.value); 
            if (qty < 0) {
                const name = input.getAttribute('data-name');
                const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
                itemsToDeduct.push({ name: name + ' (차감)', price, qty });
            }
        });

        if (itemsToDeduct.length === 0) {
            alert('차감할 수량을 입력해주세요.');
            return;
        }

        const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        const { data: existingList } = await window.mySupabase
            .from('invoices').select('id, total_amount')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hId)
            .eq('date', date)
            .limit(1);

        let invoiceId;
        if (existingList && existingList.length > 0) {
            invoiceId = existingList[0].id;
            const { error: updErr } = await window.mySupabase.from('invoices')
                .update({ total_amount: Number(existingList[0].total_amount) + totalDeductionAmount })
                .eq('id', invoiceId);
            if(updErr) throw new Error("명세서 금액 업데이트 실패: " + updErr.message);
        } else {
            invoiceId = 'inv_' + Date.now();
            const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                id: invoiceId,
                factory_id: currentFactoryId,
                hotel_id: hId,
                date: date,
                total_amount: totalDeductionAmount,
                staff_name: '관리자(차감)',
                is_sent: false
            }]);
            if(invErr) throw new Error("명세서 생성 실패: " + invErr.message);
        }

        const insertPayloads = itemsToDeduct.map(it => ({
            invoice_id: invoiceId,
            name: it.name,
            price: it.price,
            qty: it.qty
        }));

        const { error: insErr } = await window.mySupabase.from('invoice_items').insert(insertPayloads);
        if(insErr) throw new Error("품목 저장 실패: " + insErr.message);

        closeModal('deductionModal');
        
        alert('월말 차감이 성공적으로 적용되었습니다.');
        
        if (typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices(); 
        await window.sendInvoicesToClient(); 
    } catch (e) {
        console.error(e);
        alert('저장 중 오류 발생: ' + e.message);
    }
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                // 양수(정상 배송 수량)만 일일 데이터에 기록!
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                // 양수 데이터만 출력 (차감은 여기 표기 안 함)
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminRecentInvoices();
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            itemInfoMap[cleanName] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // [수정] sendKakaoOrMessage 함수가 없으므로 원래 플랫폼의 confirmSendInvoice 함수 호출로 원복!
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};
let _isInvoiceLoading = false;

window.loadAdminRecentInvoices = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        // [수정] 관리자(차감) 명세서는 목록 화면에서 안 보이게 필터링
        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId)
            .neq('staff_name', '관리자(차감)');

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            _isInvoiceLoading = false;
            return;
        }

        tbody.innerHTML = '';
        data.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
};
window.loadAdminStaffList = async function() {
    const tbody = document.getElementById('adminStaffList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">직원 목록을 불러오는 중...</td></tr>';

    const { data: staffList, error: sErr } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(sErr) { tbody.innerHTML = `<tr><td colspan="3" style="color:red;">에러: ${sErr.message}</td></tr>`; }
    else if(!staffList || staffList.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">등록된 직원이 없습니다.</td></tr>'; }
    else {
        tbody.innerHTML = '';
        staffList.forEach(s => {
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td style="font-size:13px;">${s.login_id}<br><small style="color:var(--secondary)">PW: ${s.login_pw}</small></td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td>
            </tr>`;
        });
    }

    // Load recent invoices (직원/발행 화면 하단 발행 현황 목록)
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;
    
    // pagination for staff activity list
    const itemsPerPage = 10;
    window.currentStaffPage = window.currentStaffPage || 1;
    const startIdx = (window.currentStaffPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage - 1;

    // [수정] 관리자(차감) 명세서는 직원 발행 현황에서도 보이지 않도록 필터링
    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        .neq('staff_name', '관리자(차감)')
        .order('created_at', { ascending: false })
        .range(startIdx, endIdx);

    if(iErr) { activityBody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${iErr.message}</td></tr>`; }
    else if(!invoices || invoices.length === 0) { activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>'; }
    else {
        activityBody.innerHTML = '';
        invoices.forEach(inv => {
            const displaySum = inv.total_amount || 0;
            const hName = (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음';
            activityBody.innerHTML += `<tr>
                <td style="font-size:12px;">${inv.date}</td>
                <td>${inv.staff_name || '직원'}</td>
                <td><strong>${hName}</strong></td>
                <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
            </tr>`;
        });
        
        // (페이징 버튼 렌더링 로직 유지)
        const paginationDiv = document.getElementById('adminStaffPagination');
        if(paginationDiv && count) {
            const totalPages = Math.ceil(count / itemsPerPage);
            let pageHtml = '<div style="margin-top:10px; text-align:center;">';
            for (let i = 1; i <= totalPages; i++) {
                if (i === window.currentStaffPage) {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:var(--primary); color:white; border:none; border-radius:4px;">${i}</button>`;
                } else {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;" onclick="window.currentStaffPage=${i}; window.loadAdminStaffList()">${i}</button>`;
                }
            }
            pageHtml += '</div>';
            paginationDiv.innerHTML = pageHtml;
        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
};
// 전역 변수로 현재 팝업의 차감 내역을 인메모리로 관리
window._currentDeductions = [];

window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { 
                            event.preventDefault(); 
                            const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); 
                            const idx = inputs.indexOf(this); 
                            if(idx > -1 && idx < inputs.length - 1) {
                                inputs[idx+1].focus(); 
                            } else {
                                document.getElementById('btnSaveDeduction').focus();
                            }
                        }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.saveDeduction = function() {
    const hId = document.getElementById('deductHotelId').value;
    if (!hId) return;

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value); 
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 입력해주세요.');
        return;
    }

    // 인메모리에 저장
    window._currentDeductions = itemsToDeduct;

    closeModal('deductionModal');
    
    // 발송 팝업 리렌더링 (DB 저장 없이 화면만 갱신)
    if (typeof window.sendInvoicesToClient === 'function') {
        window._isReRenderingPopup = true;
        window.sendInvoicesToClient(); 
    }
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    // 사용자가 새롭게 발송 버튼을 누른 경우(리렌더링이 아닌 경우) 메모리 초기화
    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    // 1. DB의 진짜 배송 데이터만 로드 (과거의 '관리자(차감)' 명세서는 철저히 무시)
    list.forEach(inv => {
        if (inv.staff_name === '관리자(차감)') return; // 완전 무시
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                // 현장 직원이 입력한 일반 마이너스
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    // 2. 현재 메모리에 있는 차감 내역을 가상으로 병합 (화면 표시용)
    const deductionDate = eDate; // 마지막 날짜에 차감 귀속
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // [핵심 변경] 발송하기 버튼을 눌렀을 때만 DB에 기록 적용!
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // 1. 기존 동일 기간/거래처의 과거 차감 내역은 삭제 (항상 새롭게 발송하는 개념)
            await window.mySupabase.from('invoices')
                .delete()
                .eq('factory_id', currentFactoryId)
                .eq('hotel_id', hotelFilter)
                .eq('staff_name', '관리자(차감)')
                .gte('date', sDate)
                .lte('date', eDate);

            // 2. 현재 메모리에 차감이 있다면 DB에 새로운 차감 명세서 생성
            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_deduct';
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, // 종료일에 귀속
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true // 발송과 동시에 처리됨
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }

            // 3. 발송 로그 생성
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            // 4. 일반 명세서들의 is_sent 처리
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            // 5. 카카오톡 발송 호출 (UI 호환성을 위해 try-catch 처리)
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    list.forEach(inv => {
        if (inv.staff_name === '관리자(차감)') return; 
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const deductionDate = eDate; 
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // [버그 수정] DB 스키마에 맞춰서 period 필드만 사용. (period_start, period_end 제거)
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true, 
                    memo: 'sent_log_id:' + newLog.id 
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};
// 1. 발송 팝업 수정본은 그대로 두고, 2. 내역확인 팝업만 다시 재정의 (맨 끝에 한 번만 실행되게 덮어쓰기)
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // 과거 내역을 불러올 때는, 그 발송 건(sentLogId)에 귀속된 '차감 전용 명세서'도 반드시 함께 불러와야 합니다!
    const { data: invData, error: invErr } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name, memo')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });
        
    if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

    const list = invData || [];

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // 1. 일반 명세서(staff_name이 관리자(차감)이 아닌 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (inv.staff_name !== '관리자(차감)') return true;
        // 이 차감 명세서가 현재 열어보는 발송 로그(sentLogId)를 위해 만들어졌는가?
        return inv.memo === 'sent_log_id:' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = inv.staff_name === '관리자(차감)' || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [핵심 변경] DB에 존재하지 않는 memo 컬럼 조회 제거!
    const { data: invData, error: invErr } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });
        
    if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

    const list = invData || [];

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // 1. 일반 명세서(staff_name이 '관리자(차감)_'로 시작하지 않는 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
        return inv.staff_name === '관리자(차감)_' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    // ── 스타일 헬퍼 ──────────────────────────────────────────
    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        // ── 특수거래처 ─────────────────────────────────────
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        // 컬럼
        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        // 제목 행
        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            // 카테고리 헤더
            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            // 컬럼 헤더
            const headers = globalHasDeduction ? ['품목', '단가(원)', '차감', '수량(순)', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.negQty !== 0 ? it.negQty : '0', it.netQty, it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 2 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; // 빈 행
        });

        // 공급가 / 부가세 / 총합계 행
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        // ── 일반거래처: 날짜 × 품목 매트릭스 ──────────────
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        // 제목
        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        // 기간
        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        // 헤더
        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                c.value = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                styleCell(c, { numFmt: '#,##0' });
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        // 총계 하단 안내
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
// 1. 발송 팝업 수정
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            // [핵심 로직 수정] '(차감)' 꼬리표가 붙은 항목만 월말 차감으로 분류!
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                // 일반 일일 명세서의 마이너스(-) 및 플러스(+) 수량은 모두 날짜별 데이터로 유지!
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0); // 일반 마이너스도 여기 포함
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                // 일반 명세서의 마이너스 수량은 빨간색으로 표시
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '차감', '수량(순)', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.negQty !== 0 ? it.negQty : '0', it.netQty, it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 2 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red; // 일반 마이너스는 빨간색
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
// 1. 발송 팝업 수정
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    // 사용자가 새롭게 발송 버튼을 누른 경우(리렌더링이 아닌 경우) 메모리 초기화
    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    // 1. DB의 진짜 배송 데이터만 로드 (과거의 '관리자(차감)' 명세서는 철저히 무시)
    list.forEach(inv => {
        if (inv.staff_name === '관리자(차감)') return; // 팝업창은 항상 0에서 시작해야 하므로 기존 DB 차감은 무시
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                // 현장 직원이 입력한 일반 마이너스
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    // 2. 현재 메모리에 있는 차감 내역을 가상으로 병합 (화면 표시용)
    const deductionDate = eDate; // 마지막 날짜에 차감 귀속
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // [핵심 변경] 발송하기 버튼을 눌렀을 때만 DB에 기록 (Snapshot 방식으로 HTML 자체를 영구 보존)
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // [추가] 지금 이 순간의 화면(reportHtml)에서 버튼 영역(btnHtml)만 쏙 빼서 스냅샷 HTML 생성
            const snapshotHtml = reportHtml.replace(btnHtml, '');

            // 1. 발송 로그 생성 시 화면을 그대로 보존하는 snapshot_html 컬럼 추가 (DB에 이 컬럼이 없으면 에러가 날 수 있으니 아래서 방어처리)
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            // 기존 sent_logs 테이블에 insert (현재 구조를 해치지 않고 기본 정보만 우선 저장)
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            // [추가] 차감 명세서를 생성하지 않음! 
            // 엑셀에서 다운받거나 '내역확인' 팝업을 열 때 데이터가 흔들리지 않게 하려면, 
            // 발송 로그 자체에 차감액을 기록해두거나 차감 명세서를 고정시켜야 하는데, 
            // 사장님 요청: "기존에 발행했던 차감 내역 데이터가 변하면 안 된다"
            
            // 따라서, 이 발송 건만을 위한 '고정된' 차감 명세서를 1개 생성해서 박제해둡니다.
            if (window._currentDeductions.length > 0) {
                // 발송 로그 ID를 꼬리표로 달아서 이 발송건만의 고유한 차감 내역으로 박제
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, // 종료일에 귀속
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true, 
                    // [중요] 이 차감은 어느 발송건에 속한 것인지 연결고리(비고)를 남김
                    memo: 'sent_log_id:' + newLog.id 
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            // 일반 명세서들의 is_sent 처리
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 (과거에 보낸 내역을 열어볼 때)
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [핵심 변경] 과거 내역을 불러올 때는, 그 발송 건(sentLogId)에 귀속된 '차감 전용 명세서'도 반드시 함께 불러와야 합니다!
    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name, memo')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    // [중요 필터링] 과거에 발송한 수많은 차감 내역들이 같은 기간(1~31일) 안에 쌓여있을 수 있습니다.
    // 1. 일반 명세서(staff_name이 관리자(차감)이 아닌 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (inv.staff_name !== '관리자(차감)') return true;
        // 이 차감 명세서가 현재 열어보는 발송 로그(sentLogId)를 위해 만들어졌는가?
        return inv.memo === 'sent_log_id:' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = inv.staff_name === '관리자(차감)' || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정 (내역확인 팝업과 동일하게 박제된 차감 내역만 로드)
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price), staff_name, memo')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    // [중요 필터링] 과거 엑셀을 받을 때는, 오직 해당 발송(logId)을 위해 만들어진 차감 내역만 포함시킨다.
    const filteredList = list.filter(inv => {
        if (inv.staff_name !== '관리자(차감)') return true;
        return inv.memo === 'sent_log_id:' + logId;
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = inv.staff_name === '관리자(차감)' || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    list.forEach(inv => {
        if (inv.staff_name === '관리자(차감)') return; 
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const deductionDate = eDate; 
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true
                    // [중요 변경] DB에 없는 memo 컬럼을 빼고, 대신 author나 staff_name에 sent_log_id를 박제해버림.
                    // 이렇게 하면 DB 스키마 추가 없이도 "어떤 발송에 종속된 차감인지" 추적 가능!
                    // 예: staff_name = '관리자(차감)_로그ID'
                }]);
                
                // 삽입 후 staff_name 자체를 꼬리표로 덮어쓰기 업데이트
                await window.mySupabase.from('invoices').update({ staff_name: '관리자(차감)_' + newLog.id }).eq('id', invoiceId);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [중요 변경] DB에 없는 memo 필드 조회 제거
    const { data: invData, error: invErr } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });
        
    if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

    const list = invData || [];

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // [중요 필터링] staff_name에 발송 로그 ID 꼬리표가 붙어있는지만 확인!
    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true; // 일반 명세서는 무조건 포함
        return inv.staff_name === '관리자(차감)_' + sentLogId; // 내 발송건에 속한 차감 명세서만 포함
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = inv.staff_name && inv.staff_name.startsWith('관리자(차감)') || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정 
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price), staff_name')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
        return inv.staff_name === '관리자(차감)_' + logId;
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = inv.staff_name && inv.staff_name.startsWith('관리자(차감)') || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
    URL.revokeObjectURL(url);
};
window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', currentFactoryId);

    // [수정] .neq() 쿼리에서 발생하는 에러일 수 있으므로, 서버 쿼리는 전체를 가져오고 프론트에서 필터링
    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 프론트엔드에서 '관리자(차감)' 데이터를 걸러냄 (DB 구조나 버전에 구애받지 않는 가장 안전한 방식)
    const filteredData = data.filter(inv => inv.staff_name !== '관리자(차감)');

    if (filteredData.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 전역 변수에 데이터 저장 후 페이징 렌더 함수 호출
    // 레거시 코드와 완벽 호환되도록 전역 객체명 원복
    window._staffInvoiceAllData = filteredData;
    window._staffInvoicePage = 1;
    
    if (typeof window.renderStaffInvoicePage === 'function') {
        window.renderStaffInvoicePage();
    } else if (typeof renderStaffInvoicePage === 'function') {
        renderStaffInvoicePage();
    } else {
        console.error("renderStaffInvoicePage 함수가 없습니다.");
    }
};
