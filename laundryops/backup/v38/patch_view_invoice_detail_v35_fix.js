window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type, hotel_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        console.error("DEBUG viewInvoiceDetail error:", error);
        alert('데이터를 찾을 수 없습니다. 에러: ' + (error ? error.message : '')); 
        return; 
    }

    const h = inv.hotels || {};
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 2단 구성 (category DB에서 빼고 직접 매칭)
        const grouped = {};
        
        // hotel_item_prices 에서 카테고리 정보 가져와서 매핑
        const { data: hItems } = await window.mySupabase.from('hotel_item_prices').select('name, category_name').eq('hotel_id', inv.hotel_id);
        const catMap = {};
        if (hItems) {
            hItems.forEach(hi => {
                catMap[hi.name] = hi.category_name || '기타';
            });
        }
        
        // hotel_categories 에서 순서 가져오기
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', inv.hotel_id).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타');

        orderedCats.forEach(c => grouped[c] = []);

        items.forEach(it => {
            const cat = catMap[it.name] || '기타';
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
                    공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
                </div>
            </div>`;
    } else {
        // [일반거래처]
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
                        ${items.map(it => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${it.name}</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${Number(it.price).toLocaleString()}원</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:center;">${it.qty}</td>
                                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align:right;">${(Number(it.price) * Number(it.qty)).toLocaleString()}원</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                    <div>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</div>
                    <div>총 합계: ₩ ${totalAmount.toLocaleString()}</div>
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
    } else {
        alert('상세내역을 불러왔습니다 (모달 영역이 없습니다).');
    }
};
