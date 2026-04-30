window.downloadExcel = async function(hotelName, period, groupId) {
    const { data: hotels } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).eq('name', hotelName);
    const h = hotels && hotels.length > 0 ? hotels[0] : null;
    if (!h) { alert('거래처 정보를 찾을 수 없습니다.'); return; }
    
    let sDate, eDate;
    if (period.includes('~')) {
        [sDate, eDate] = period.split(' ~ ').map(s => s.trim());
    } else {
        sDate = period;
        eDate = period;
    }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', h.id)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('데이터가 없습니다.'); return; }
    
    const dateSequence = [];
    let curDate = new Date(sDate);
    const endD = new Date(eDate);
    while (curDate <= endD) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const matrix = {};
    const itemTotalQtys = {};
    const itemPrices = {};
    
    list.forEach(inv => {
        if(!matrix[inv.date]) matrix[inv.date] = {};
        (inv.invoice_items || []).forEach(it => {
            const q = Number(it.qty) || 0;
            matrix[inv.date][it.name] = (matrix[inv.date][it.name] || 0) + q;
            itemTotalQtys[it.name] = (itemTotalQtys[it.name] || 0) + q;
            itemPrices[it.name] = Number(it.price) || 0;
        });
    });

    const hotelItemNames = (h.items || []).map(i => (typeof i === 'string' ? i : i.name));
    const allKnownItems = Object.keys(itemTotalQtys);
    
    const activeItems = allKnownItems.filter(name => itemTotalQtys[name] > 0).sort((a, b) => {
        const idxA = hotelItemNames.findIndex(n => n.toLowerCase() === a.toLowerCase());
        const idxB = hotelItemNames.findIndex(n => n.toLowerCase() === b.toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    
    let csvContent = "\ufeff납품일자," + activeItems.join(",") + "\n";
    
    dateSequence.forEach(d => {
        let row = d.split('-')[2];
        activeItems.forEach(name => {
            const qty = (matrix[d] && matrix[d][name]) ? matrix[d][name] : 0;
            row += "," + (qty > 0 ? qty.toLocaleString() : "");
        });
        csvContent += row + "\n";
    });

    const qtyTotals = activeItems.map(name => itemTotalQtys[name] || 0);
    const prices = activeItems.map(name => itemPrices[name] || 0);

    csvContent += "수량 합계," + qtyTotals.map(q => q.toLocaleString()).join(",") + "\n";
    csvContent += "단가," + prices.map(p => "₩ " + p.toLocaleString()).join(",") + "\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${hotelName}_${period}_정산내역.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};