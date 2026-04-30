window.mySendInvoices = async function() {
    console.log('DEBUG: mySendInvoices (Matrix UI) 시작');
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    // 날짜 리스트 및 모든 품목 추출
    const dates = [];
    let d = new Date(sDate);
    const endD = new Date(eDate);
    while (d <= endD) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
    }

    const itemNames = new Set();
    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => itemNames.add(it.name));
    });
    const sortedItems = Array.from(itemNames).sort();

    // 데이터 매트릭스 생성
    const matrix = {};
    dates.forEach(date => {
        matrix[date] = {};
        sortedItems.forEach(item => matrix[date][item] = 0);
    });

    list.forEach(inv => {
        if (!matrix[inv.date]) return;
        (inv.invoice_items || []).forEach(it => {
            matrix[inv.date][it.name] = (matrix[inv.date][it.name] || 0) + Number(it.qty || 0);
        });
    });

    // 테이블 생성
    let tableHtml = `
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #ddd; padding:5px;">날짜</th>
                    ${sortedItems.map(item => `<th style="border:1px solid #ddd; padding:5px;">${item}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${dates.map(date => `
                    <tr>
                        <td style="border:1px solid #ddd; padding:5px; font-weight:700;">${date}</td>
                        ${sortedItems.map(item => `<td style="border:1px solid #ddd; padding:5px; text-align:center;">${matrix[date][item] || '-'}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

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