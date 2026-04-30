window.mySendInvoices = async function() {
    console.log('DEBUG: mySendInvoices (Matrix UI) 시작');
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    // 1. 단가 설정 정보 가져오기 (정렬 순서 보장)
    const { data: itemPrices } = await window.mySupabase.from('hotel_item_prices')
        .select('name, price')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    const sortedItems = itemPrices || [];
    const itemNames = sortedItems.map(it => it.name);

    // 2. 데이터 가져오기
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list) { alert('데이터를 불러오지 못했습니다.'); return; }

    // 3. 날짜 리스트 생성
    const dates = [];
    let d = new Date(sDate);
    const endD = new Date(eDate);
    while (d <= endD) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }

    // 4. 데이터 매트릭스 생성
    const matrix = {};
    dates.forEach(date => {
        matrix[date] = {};
        itemNames.forEach(name => matrix[date][name] = 0);
    });

    list.forEach(inv => {
        if (!matrix[inv.date]) return;
        (inv.invoice_items || []).forEach(it => {
            if(matrix[inv.date].hasOwnProperty(it.name)) {
                matrix[inv.date][it.name] += Number(it.qty || 0);
            }
        });
    });

    // 5. 합계 계산
    const qtyTotals = {};
    itemNames.forEach(name => qtyTotals[name] = 0);
    
    dates.forEach(date => {
        itemNames.forEach(name => {
            qtyTotals[name] += matrix[date][name];
        });
    });

    // 6. 테이블 HTML 생성
    const headerHtml = itemNames.map(name => `<th style="border:1px solid #ddd; padding:5px;">${name}</th>`).join('');
    const rowsHtml = dates.map(date => `
        <tr>
            <td style="border:1px solid #ddd; padding:5px; font-weight:700;">${date.split('-')[2]}일</td>
            ${itemNames.map(name => `<td style="border:1px solid #ddd; padding:5px; text-align:center;">${matrix[date][name] > 0 ? matrix[date][name] : '-'}</td>`).join('')}
        </tr>
    `).join('');
    
    const footerHtml = `
        <tr style="background:#f8fafc; font-weight:700;">
            <td style="border:1px solid #ddd; padding:5px;">수량합계</td>
            ${itemNames.map(name => `<td style="border:1px solid #ddd; padding:5px; text-align:center;">${qtyTotals[name]}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc; font-weight:700;">
            <td style="border:1px solid #ddd; padding:5px;">단가</td>
            ${itemNames.map(name => `<td style="border:1px solid #ddd; padding:5px; text-align:center;">${(sortedItems.find(x => x.name === name)?.price || 0).toLocaleString()}</td>`).join('')}
        </tr>
        <tr style="background:#f8fafc; font-weight:700;">
            <td style="border:1px solid #ddd; padding:5px;">항목합계</td>
            ${itemNames.map(name => `<td style="border:1px solid #ddd; padding:5px; text-align:center;">${(qtyTotals[name] * (sortedItems.find(x => x.name === name)?.price || 0)).toLocaleString()}</td>`).join('')}
        </tr>
    `;

    const tableHtml = `<table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
            <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #ddd; padding:5px;">날짜</th>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>${footerHtml}</tfoot>
        </table>`;

    const totalAmount = Object.keys(qtyTotals).reduce((sum, name) => sum + (qtyTotals[name] * (sortedItems.find(x => x.name === name)?.price || 0)), 0);
    const supplyPrice = Math.floor(totalAmount / 1.1);
    const vat = totalAmount - supplyPrice;

    let reportHtml = `
        <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
        ${tableHtml}
        <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        <div style="text-align:center; margin-top:30px;">
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 정산명세서를 발송하시겠습니까?`)) {
            try {
                const ids = list.map(inv => inv.id);
                await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
                
                const sentLogData = {
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    period: `${sDate} ~ ${eDate}`,
                    total_amount: totalAmount,
                    sent_at: new Date().toISOString()
                };
                
                const { error: logErr } = await window.mySupabase.from('sent_logs').insert([sentLogData]);
                if (logErr) throw logErr;
                
                alert('발송이 완료되었습니다.');
                window.loadAdminRecentInvoices(); 
                window.loadAdminSentList(); 
                closeModal('sendInvoiceModal');
            } catch (e) {
                alert('발송 기록 저장 중 오류 발생: ' + e.message);
                console.error(e);
            }
        }
    };
    
    openModal('sendInvoiceModal');
};