
// Final fix for duplicate invoice list
window.isInvoiceLoading = false;
window.loadAdminRecentInvoices = async function(returnList = false) {
    if (window.isInvoiceLoading) return;
    window.isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { window.isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId);

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        // DEDUPLICATION: Ensure unique invoices by ID
        const uniqueInvoices = data ? Array.from(new Map(data.map(item => [item.id, item])).values()) : [];

        if (uniqueInvoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        uniqueInvoices.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
    } finally {
        window.isInvoiceLoading = false;
    }
};
