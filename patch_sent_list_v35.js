// 패치 수정: 충돌 방지를 위해 이름 변경
window.loadAdminSentList_Legacy = async function() {
    const tbody = document.getElementById('adminSentList');
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">목록 불러오는 중...</td></tr>';

    try {
        // [v38 최종] updated_at 등 불필요 컬럼 제거 및 정확한 쿼리
        const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, hotel_id, is_sent, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true)
            .order('date', { ascending: false });

        if (error) {
            console.error("DB 에러:", error);
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        const grouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7); 
                const key = inv.hotel_id + '_' + month;
                
                if(!grouped[key]) {
                    grouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: inv.hotels ? inv.hotels.name : '알수없음',
                        month: month,
                        totalAmount: 0,
                        lastSent: inv.date
                    };
                }
                grouped[key].totalAmount += (inv.total_amount || 0);
            });
        }

        const resultArr = Object.values(grouped);
        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 월정산 내역이 없습니다.</td></tr>';
            return;
        }

        resultArr.sort((a,b) => new Date(b.lastSent) - new Date(a.lastDate));

        tbody.innerHTML = '';
        resultArr.forEach(inv => {
            tbody.innerHTML += `<tr>
                <td>${inv.month}</td>
                <td><strong>${inv.hotelName}</strong></td>
                <td style="text-align:right;">${inv.totalAmount.toLocaleString()}원</td>
                <td>${inv.lastDate}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.month}', '${inv.lastDate}')">상세조회</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="cancelMonthlyInvoice('${inv.lastDate}', '${inv.hotelId}', '${inv.month}')">발송취소</button>
                </td>
            </tr>`;
        });
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">스크립트 에러: ${err.message}</td></tr>`;
    }
};

window.cancelMonthlyInvoice = async function(sentAt, hotelId, period) {
    if(!confirm('이 월정산 명세서의 발송을 취소하시겠습니까?')) return;

    try {
        const { data: list } = await window.mySupabase.from('invoices')
            .select('id')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hotelId)
            .like('date', period + '%')
            .eq('is_sent', true);

        if (list && list.length > 0) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: false }).in('id', ids);
        }

        alert('발송 취소되었습니다.');
        window.loadAdminSentList();
        if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices(); 

    } catch(err) {
        alert('취소 실패: ' + err.message);
    }
};

window.viewSentDetail = function(hotelName, month, sentAt) {
    alert(`${hotelName}의 ${month}월 정산 상세 내역은 '매출 및 경영 지표' 탭에서 확인하세요.`);
};
