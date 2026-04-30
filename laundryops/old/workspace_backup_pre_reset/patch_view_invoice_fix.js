window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        console.error("DEBUG viewInvoiceDetail error:", error);
        alert('데이터를 찾을 수 없습니다. 에러: ' + (error ? error.message : '')); 
        return; 
    }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        items.forEach(it => {
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
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};
