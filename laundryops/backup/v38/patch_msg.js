window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    // 모달창에 띄울 내용
    let reportHtml = `
        <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
        
        <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        
        <div style="text-align:center; margin-top:30px; font-size: 15px; color: var(--secondary);">
            위 내역으로 거래처 담당자에게 정산명세서를 발송하시겠습니까?<br>
            <span style="font-size:12px; color:#ef4444;">(추후 카카오톡/문자 연동 시 해당 채널로 발송됩니다.)</span>
        </div>
        
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 명세서를 발송 처리하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송 처리가 완료되었습니다.'); // 카카오톡 멘트 제거
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};
