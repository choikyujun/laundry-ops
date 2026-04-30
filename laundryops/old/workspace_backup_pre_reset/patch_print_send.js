window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, items, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

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
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name || '-'}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.qty || 0).toLocaleString()}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
        // [일반거래처] 매트릭스 방식 복원
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};

