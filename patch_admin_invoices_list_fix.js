// 대표 화면 명세서 목록 및 삭제 버튼 완벽 복구
window.isAdminInvoicesLoading = false;

window.loadAdminRecentInvoices = async function(returnList = false) {
    if (window.isAdminInvoicesLoading) return;
    window.isAdminInvoicesLoading = true;

    try {
        const tbody = document.getElementById('adminRecentInvoiceList');
        if(!tbody) return;
        
        // 테이블 헤더 열 개수에 맞춰 colspan 자동 조절 (6 or 7)
        const thead = tbody.closest('table').querySelector('thead tr');
        const colCount = thead ? thead.cells.length : 6;
        
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;">명세서를 불러오는 중...</td></tr>`;

        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        let query = window.mySupabase
            .from('invoices')
            .select('*')
            .eq('factory_id', currentFactoryId);

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;">조건에 맞는 명세서가 없습니다.</td></tr>`;
            return;
        }

        // 모든 호텔 이름 미리 가져오기
        const { data: hotels } = await window.mySupabase.from('hotels').select('id, name, contract_type');
        const hotelMap = {};
        if(hotels) hotels.forEach(h => hotelMap[h.id] = h);

        let newHtml = '';
        data.forEach(inv => {
            const h = hotelMap[inv.hotel_id];
            const hName = h ? h.name : '알수없음';
            const cType = (h && h.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:#94a3b8; color:white;">미발송</span>';

            // 목록에서는 무조건 총액(inv.total_amount) 노출
            const supplyPrice = inv.total_amount || 0;

            // 첫 번째 칸(체크박스 열)이 있는지 확인하여 조건부 렌더링
            const checkboxHtml = colCount === 7 ? `<td><input type="checkbox" class="invoice-checkbox" value="${inv.id}"></td>` : '';

            newHtml += `
            <tr>
                ${checkboxHtml}
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${supplyPrice.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
        
        tbody.innerHTML = newHtml;
    } finally {
        window.isAdminInvoicesLoading = false;
    }
};
