window.exportInvoicesToPDF = function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hotelFilter];
    const isSpecial = h && h.hotelType === 'special';

    const list = window.loadAdminRecentInvoices(true).filter(inv => inv.date >= sDate && inv.date <= eDate);
    if(list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    // 일자별/품목별 데이터 집계
    const dailyData = {};
