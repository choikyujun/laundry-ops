
// Debug-enabled Patch
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';
    
    // Fetch invoices
    const { data: list, error: invError } = await window.mySupabase.from('invoices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(invError) { alert('인보이스를 불러오는데 실패했습니다.'); console.error(invError); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const invoiceIds = list.map(i => i.id);
    const { data: allItems, error: itemError } = await window.mySupabase.from('invoice_items')
        .select('*')
        .in('invoice_id', invoiceIds);

    if(itemError) { alert('아이템을 불러오는데 실패했습니다.'); console.error(itemError); return; }

    // Join locally
    list.forEach(inv => {
        inv.invoice_items = allItems.filter(it => it.invoice_id === inv.id);
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const reportHtml = window.generateInvoiceMatrixHtml(h, list, sDate, eDate, supplyPrice, vat, totalAmount, false, list, isSpecial);

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

    const { data: list, error: invError } = await window.mySupabase.from('invoices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(invError) { alert('인보이스를 불러오는데 실패했습니다.'); return; }
    
    const invoiceIds = list.map(i => i.id);
    const { data: allItems } = await window.mySupabase.from('invoice_items')
        .select('*')
        .in('invoice_id', invoiceIds);

    list.forEach(inv => {
        inv.invoice_items = allItems.filter(it => it.invoice_id === inv.id);
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const reportHtml = window.generateInvoiceMatrixHtml(h, list, sDate, eDate, supplyPrice, vat, totalAmount, true, list, isSpecial);

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 정산명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            alert('발송 처리가 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    openModal('sendInvoiceModal');
};

window.generateInvoiceMatrixHtml = function(h, list, sDate, eDate, supplyPrice, vat, totalAmount, isSendDialog, fullList, isSpecial) {
    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};
    const itemOrderMap = {};
    (h.items || []).forEach((item, idx) => itemOrderMap[item.name] = item.sort_order ?? idx);

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + Number(it.qty || 0);
            itemInfoMap[it.name] = { price: Number(it.price || 0), category: it.category || '기타' };
        });
    });

    const sortedItemNames = Object.keys(itemInfoMap).sort((a,b) => (itemOrderMap[a] ?? 999) - (itemOrderMap[b] ?? 999));

    const styleContent = `
        <style>
            .report-container { font-family: 'Malgun Gothic', sans-serif; font-size: 9px; padding: 10px; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            .report-table th { background: #f1f5f9; padding: 2px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; font-weight: 700; }
            .report-table td { padding: 2px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; }
            .blue-col { background: #f1f5f9 !important; color: #000 !important; font-weight: 700; }
            .total-row { font-weight: 700; }
        </style>
    `;

    const sendButton = isSendDialog ? `<div style="text-align:center; margin-top:20px;">
        <button id="sendInvBtn" style="padding: 15px 40px; font-size: 18px; cursor:pointer; background:var(--primary); color:white; border:none; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            🚀 거래처로 발송하기 (${fullList.length}건)
        </button>
    </div>` : '';

    let htmlContent = '';
    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = {};
            let totalQty = 0;
            dateSequence.forEach(d => { if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name]; });
            grouped[cat][name] = { qty: totalQty, price: itemInfoMap[name].price };
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; display:inline-block; width:48%; vertical-align:top; margin-right: 1%;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table class="report-table" style="margin-top:0;">
                    <thead><tr><th>품목</th><th>단가</th><th>수량</th><th>금액</th></tr></thead>
                    <tbody>
                        ${Object.keys(grouped[cat]).map(name => `<tr>
                            <td>${name}</td>
                            <td>${grouped[cat][name].price.toLocaleString()}</td>
                            <td>${grouped[cat][name].qty.toLocaleString()}</td>
                            <td>₩ ${(grouped[cat][name].price * grouped[cat][name].qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });
        htmlContent = `<div class="report-container">${categoriesHtml}</div>`;
    } else {
        htmlContent = `<div class="report-container">
            <table class="report-table">
                <thead><tr><th class="blue-col">일자</th>${sortedItemNames.map(name => `<th>${name}</th>`).join('')}</tr></thead>
                <tbody>
                    ${dateSequence.map(d => `<tr><td class="blue-col">${parseInt(d.substring(8))}</td>${sortedItemNames.map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}</tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row" style="background:#e2e8f0;"><td class="blue-col">수량 합계</td>${sortedItemNames.map(name => { const t = dateSequence.reduce((s,d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0); return `<td>${t}</td>`; }).join('')}</tr>
                    <tr class="total-row" style="background:#f1f5f9;"><td class="blue-col">단가</td>${sortedItemNames.map(name => `<td>${itemInfoMap[name].price.toLocaleString()}</td>`).join('')}</tr>
                    <tr class="total-row" style="background:#fef3c7;"><td class="blue-col">항목 합계</td>${sortedItemNames.map(name => { const t = dateSequence.reduce((s,d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0); return `<td>₩ ${(t * itemInfoMap[name].price).toLocaleString()}</td>`; }).join('')}</tr>
                </tfoot>
            </table>
        </div>`;
    }

    const wrapper = `
        <div class="report-container">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:5px; font-size: 16px;">세탁 거래명세서 (${h.name})</h1>
            ${htmlContent}
            <div style="margin-top:10px; padding:8px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 11px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 13px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            ${sendButton}
        </div>
    `;

    if (isSendDialog) return styleContent + wrapper;
    return `<html><head>${styleContent}</head><body>${wrapper}</body></html>`;
};
