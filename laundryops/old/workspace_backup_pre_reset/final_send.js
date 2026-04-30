
window.sendInvoicesToClient = async function() {
    console.log('DEBUG: sendInvoicesToClient (Matrix UI) 시작');
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: itemPrices } = await window.mySupabase.from('hotel_item_prices')
        .select('name, price')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    const priceMap = new Map();
    (itemPrices || []).forEach(it => priceMap.set(it.name, it.price));

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list) { alert('데이터를 불러오지 못했습니다.'); return; }

    const allItemNames = new Set();
    list.forEach(inv => (inv.invoice_items || []).forEach(it => allItemNames.add(it.name)));
    const sortedItems = Array.from(allItemNames).sort((a, b) => {
        const idxA = (itemPrices || []).findIndex(x => x.name === a);
        const idxB = (itemPrices || []).findIndex(x => x.name === b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const dates = [];
    let d = new Date(sDate);
    const endD = new Date(eDate);
    while (d <= endD) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }

    const matrix = {};
    const itemTotalQty = {};
    const itemTotalAmt = {};
    
    dates.forEach(date => { matrix[date] = {}; sortedItems.forEach(n => matrix[date][n] = 0); });
    sortedItems.forEach(n => { itemTotalQty[n] = 0; itemTotalAmt[n] = 0; });

    list.forEach(inv => {
        if (!matrix[inv.date]) return;
        (inv.invoice_items || []).forEach(it => {
            if(matrix[inv.date].hasOwnProperty(it.name)) {
                const qty = Number(it.qty || 0);
                const price = Number(it.price || priceMap.get(it.name) || 0);
                matrix[inv.date][it.name] += qty;
                itemTotalQty[it.name] += qty;
                itemTotalAmt[it.name] += (qty * price);
            }
        });
    });

    const cellStyle = "border:1px solid #ddd; padding:1px 5px;";
    const headerHtml = sortedItems.map(name => `<th style="${cellStyle}">${name}</th>`).join('');
    const rowsHtml = dates.map(date => `
        <tr style="height:20px;">
            <td style="${cellStyle} font-weight:700;">${date.split('-')[2]}일</td>
            ${sortedItems.map(name => `<td style="${cellStyle} text-align:center;">${matrix[date][name] > 0 ? matrix[date][name] : '-'}</td>`).join('')}
        </tr>
    `).join('');
    
    const footerHtml = `
        <tr style="background:#f8fafc; font-weight:700; height:20px;">
            <td style="${cellStyle}">수량합계</td>
            ${sortedItems.map(name => `<td style="${cellStyle} text-align:center;">${itemTotalQty[name]}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc; font-weight:700; height:20px;">
            <td style="${cellStyle}">단가(참고)</td>
            ${sortedItems.map(name => `<td style="${cellStyle} text-align:center;">${(priceMap.get(name) || 0).toLocaleString()}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc; font-weight:700; height:20px;">
            <td style="${cellStyle}">항목합계</td>
            ${sortedItems.map(name => `<td style="${cellStyle} text-align:center;">${itemTotalAmt[name].toLocaleString()}</td>`).join('')}
        </tr>
    `;

    const tableHtml = `<table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:5px;">
            <thead><tr style="background:#f1f5f9; height:20px;"><th style="${cellStyle}">날짜</th>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>${footerHtml}</tfoot>
        </table>`;

    const totalAmount = Object.values(itemTotalAmt).reduce((sum, amt) => sum + amt, 0);
    const supplyPrice = Math.floor(totalAmount / 1.1);
    const vat = totalAmount - supplyPrice;

    const modalBtnId = 'sendInvBtn_' + Date.now();
    let reportHtml = `
        <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
        ${tableHtml}
        <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        <div style="text-align:center; margin-top:30px;">
            <button id="${modalBtnId}" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    document.getElementById(modalBtnId).onclick = async function() {
        if(confirm(`${h.name} 거래처로 정산명세서를 발송하시겠습니까?`)) {
            try {
                const ids = list.map(inv => inv.id);
                await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
                const sentLogData = { factory_id: currentFactoryId, hotel_id: hotelFilter, period: `${sDate} ~ ${eDate}`, total_amount: totalAmount, sent_at: new Date().toISOString() };
                const { error: logErr } = await window.mySupabase.from('sent_logs').insert([sentLogData]);
                if (logErr) throw logErr;
                alert('발송이 완료되었습니다.');
                window.loadAdminRecentInvoices(); 
                window.loadAdminSentList(); 
                closeModal('sendInvoiceModal');
            } catch (e) { alert('발송 기록 저장 중 오류 발생: ' + e.message); }
        }
    };
    openModal('sendInvoiceModal');
};

window.loadAdminSentList = async function() {
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">목록 불러오는 중...</td></tr>';
    const { data: logs, error } = await window.mySupabase.from('sent_logs')
        .select('id, period, total_amount, sent_at, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .order('sent_at', { ascending: false });
    if(error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">에러: ${error.message}</td></tr>`; return; }
    tbody.innerHTML = '';
    if(!logs || logs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송 내역이 없습니다.</td></tr>'; return; }
    logs.forEach(log => {
        tbody.innerHTML += `<tr>
            <td>${log.period}</td>
            <td>${log.hotels ? log.hotels.name : '삭제된 거래처'}</td>
            <td>${log.total_amount.toLocaleString()}원</td>
            <td>${log.sent_at.replace('T', ' ').substring(0, 19)}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSentLog('${log.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteSentLog = async function(id) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('sent_logs').delete().eq('id', id);
    window.loadAdminSentList();
};
