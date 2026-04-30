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
