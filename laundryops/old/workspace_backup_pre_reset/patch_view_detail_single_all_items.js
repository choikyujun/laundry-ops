// [보기] 버튼 눌렀을 때 거래명세서 팝업 상세 (모든 항목 노출 및 수량 0 허용)
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
    // 전체 항목 기준으로 리스트 재구성
    let mergedItems = [];
    if (allItems && allItems.length > 0) {
        allItems.forEach(ai => {
            const q = getQty(ai.name);
            supplyPrice += (Number(ai.price) * q);
            mergedItems.push({
                name: ai.name,
                price: ai.price,
                qty: q,
                category_name: ai.category_name || '기타'
            });
        });
    } else {
        // 단가표가 없으면 명세서에 기록된 항목만 노출
        items.forEach(i => {
            const q = Number(i.qty) || 0;
            supplyPrice += (Number(i.price) * q);
            mergedItems.push({
                name: i.name,
                price: i.price,
                qty: q,
                category_name: '기타'
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
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <div style="overflow-x:auto;">
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
                </div>
            </div>`;
        });

        reportHtml = `
            <div id='invoice-detail-print-area' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px; align-items:start;">
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
