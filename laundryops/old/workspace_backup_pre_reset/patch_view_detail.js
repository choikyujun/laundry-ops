window.viewSentDetail = async function(hotelName, period, sentAt, isPartnerView) {
    // 1. 거래처 정보 가져오기
    const { data: hotels } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).eq('name', hotelName);
    const h = hotels && hotels.length > 0 ? hotels[0] : null;

    if (!h) {
        alert('거래처 정보를 찾을 수 없습니다.');
        return;
    }

    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';
    
    // 2. 항목 데이터 수집
    let list = [];
    let isRange = period.includes('~');
    let sDate, eDate;

    if (isRange) {
        [sDate, eDate] = period.split(' ~ ');
    } else {
        sDate = period;
        eDate = period;
    }

    // DB에서 데이터 가져오기 (invoice + invoice_items)
    const { data: dbInvoices } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, total_amount, invoice_items(name, qty, price, unit, category)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', h.id)
        .gte('date', sDate)
        .lte('date', eDate);
        
    if (dbInvoices && dbInvoices.length > 0) {
        // format them like old history items
        dbInvoices.forEach(inv => {
            if (inv.invoice_items && inv.invoice_items.length > 0) {
                list.push({
                    date: inv.date,
                    totalAmount: inv.total_amount,
                    items: inv.invoice_items
                });
            }
        });
    }

    // 구버전 데이터 병합 (history)
    const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
    if (f && f.history) {
        const localList = f.history.filter(inv => inv.hotelId === h.id || inv.hotelName === h.name);
        localList.forEach(inv => {
            if (inv.date >= sDate && inv.date <= eDate && !list.find(d => d.date === inv.date)) {
                list.push(inv);
            }
        });
    }

    if (list.length === 0) {
        alert('상세 내역 항목이 없습니다.');
        return;
    }

    // 금액 계산
    let supplyPrice = 0;
    list.forEach(inv => {
        supplyPrice += (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    });
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        // 특수거래처 (2단 구성)
        const grouped = {};
        
        // 호텔 카테고리 로드
        const { data: cats } = await window.mySupabase.from('hotel_categories').select('name').eq('hotel_id', h.id).order('created_at');
        const hotelCategories = cats && cats.length > 0 ? cats.map(c => c.name) : ['기타'];
        
        hotelCategories.forEach(cat => grouped[cat] = []);

        list.forEach(inv => {
            (inv.items || []).forEach(it => {
                const cat = it.category || '기타';
                if(!grouped[cat]) grouped[cat] = [];
                let item = grouped[cat].find(i => i.name === it.name);
                if (item) {
                    item.qty += Number(it.qty);
                } else {
                    grouped[cat].push({ name: it.name, qty: Number(it.qty), price: Number(it.price) });
                }
            });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
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
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                                <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id='sent-report-to-print' style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto; background: white;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">월정산 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${period}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </div>`;
    } else {
        // 일반거래처 (매트릭스 달력 디자인)
        const startDate = new Date(sDate);
        const endDate = new Date(eDate);
        const allDates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        const itemPrices = {};
        list.forEach(inv => {
            inv.items.forEach(it => {
                if(!itemPrices[it.name]) itemPrices[it.name] = Number(it.price);
            });
        });

        const allItems = Object.keys(itemPrices);
        const matrix = {};
        allDates.forEach(d => {
            matrix[d] = {};
            allItems.forEach(name => matrix[d][name] = 0);
        });

        list.forEach(inv => {
            if (matrix[inv.date]) {
                inv.items.forEach(it => {
                    matrix[inv.date][it.name] = (matrix[inv.date][it.name] || 0) + Number(it.qty);
                });
            }
        });

        const qtyTotals = {};
        const priceTotals = {};
        allItems.forEach(name => {
            let totalQty = 0;
            allDates.forEach(d => totalQty += (matrix[d][name] || 0));
            qtyTotals[name] = totalQty;
            priceTotals[name] = totalQty * (itemPrices[name] || 0);
        });

        reportHtml = `
        <div id='sent-report-to-print' style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; background: white;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">월정산 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${period}</div>
            <div style="overflow-x:auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 12px; min-width: 600px;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding: 2px 4px; border: 1px solid #cbd5e1;">일자</th>
                        ${allItems.map(name => `<th style="padding: 2px 4px; border: 1px solid #cbd5e1;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => `
                        <tr>
                            <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${parseInt(d.substring(8))}</td>
                            ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${matrix[d][name] || 0}</td>`).join('')}
                        </tr>
                    `).join('')}
                    <tr style="background:#f1f5f9; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">수량 합계</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${qtyTotals[name]}</td>`).join('')}
                    </tr>
                    <tr style="background:#f9fafb; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">단가</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${itemPrices[name].toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background:#fffbeb; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">항목 합계</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${priceTotals[name].toLocaleString()}</td>`).join('')}
                    </tr>
                </tbody>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                <div>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</div>
                <div>총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // sendInvBtn 숨기기 (발송 확인 모달 재사용)
    if(document.getElementById('sendInvBtn')) document.getElementById('sendInvBtn').style.display = 'none';
    
    openModal('sendInvoiceModal');
};
