window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    // 호텔 정보 가져오기
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    const isSpecial = h.contract_type === 'special'; // [v35] special 필드 확인 필요. 보통은 contract_type='fixed' or 'unit'. 

    // 필터에 맞는 명세서(와 품목 jsonb) 가져오기
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

    // 일자별/품목별 데이터 집계
    const dailyData = {};
    const itemInfoMap = {}; // {name: {price, unit, category}}

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

    // TODO: 특수거래처용 렌더링 유지
    reportHtml = `
    <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
    <body>
        <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
        <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
            공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
        </div>
        <table style="width:100%; margin-top:20px; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #cbd5e1; padding:8px;">일자</th>
                    <th style="border:1px solid #cbd5e1; padding:8px;">품목명</th>
                    <th style="border:1px solid #cbd5e1; padding:8px;">수량</th>
                    <th style="border:1px solid #cbd5e1; padding:8px;">단가</th>
                    <th style="border:1px solid #cbd5e1; padding:8px;">금액</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(inv => (inv.items || []).map(it => `
                <tr>
                    <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${inv.date}</td>
                    <td style="border:1px solid #cbd5e1; padding:5px;">${it.name}</td>
                    <td style="border:1px solid #cbd5e1; padding:5px; text-align:center;">${it.qty}</td>
                    <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                    <td style="border:1px solid #cbd5e1; padding:5px; text-align:right;">${(it.qty * it.price).toLocaleString()}</td>
                </tr>
                `).join('')).join('')}
            </tbody>
        </table>
    </body></html>`;

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

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
        // DB 업데이트 (is_sent = true)
        const ids = list.map(inv => inv.id);
        await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
        
        alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
        window.loadAdminRecentInvoices(); // 목록 새로고침
    }
};
