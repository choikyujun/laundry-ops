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
