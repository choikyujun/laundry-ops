window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        (inv.items || []).forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
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
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        </body></html>`;
    } else {
        reportHtml = `
        <html><head><style>@page { size: A5; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; } table { width:100%; border-collapse:collapse; margin-top:20px; } th, td { border:1px solid #000; padding:8px; font-size:12px; } th { background:#f1f5f9; text-align:center; } td.num { text-align:right; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">거래명세서</h1>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div style="font-weight:700; font-size:18px;">${inv.hotels?inv.hotels.name:''} 귀하</div>
                <div style="text-align:right; font-size:12px;">일자: ${inv.date}<br>담당자: ${inv.staff_name||''}</div>
            </div>
            <table>
                <thead><tr><th>품목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
                <tbody>
                    ${(inv.items || []).map(it => `<tr>
                        <td>${it.name}</td>
                        <td class="num">${it.qty}</td>
                        <td class="num">${Number(it.price||0).toLocaleString()}</td>
                        <td class="num">${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; background:#eff6ff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:18px;">총 합계: ₩ ${total.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};
