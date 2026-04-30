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
