window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    // select * 로 변경해서 에러 방지
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('에러: ' + error.message); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }
// ...
