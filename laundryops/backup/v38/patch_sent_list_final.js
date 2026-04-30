// Legacy: Patch
window.loadAdminSentList_Legacy = async function() { console.log("Disabled patch_sent_list_final"); };
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">목록 불러오는 중...</td></tr>';

    try {
        console.log("DEBUG: Loading AdminSentList...");
        
        const { data: list, error } = await window.mySupabase.from('invoices')
            .select('date, total_amount, hotel_id, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true)
            .order('date', { ascending: false });

        if (error) {
            console.error("DEBUG: Supabase Error:", error);
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        console.log("DEBUG: Loaded invoices:", list);

        const grouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '알수없음').substring(0, 7); 
                const key = inv.hotel_id + '_' + month;
                if(!grouped[key]) {
                    grouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: (inv.hotels && inv.hotels.name) ? inv.hotels.name : '거래처없음',
                        month: month,
                        totalAmount: 0,
                        lastDate: inv.date
                    };
                }
                grouped[key].totalAmount += (inv.total_amount || 0);
            });
        }

        const resultArr = Object.values(grouped);
        
        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다.</td></tr>';
            return;
        }

        resultArr.sort((a,b) => new Date(b.lastDate) - new Date(a.lastDate));

        tbody.innerHTML = '';
        resultArr.forEach(inv => {
            tbody.innerHTML += `<tr>
                <td>${inv.month}</td>
                <td><strong>${inv.hotelName}</strong></td>
                <td>${inv.totalAmount.toLocaleString()}원</td>
                <td>${inv.lastDate}</td>
                <td>
                    <button class="btn btn-neutral" style="background:var(--primary); color:white; padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.month}', '${inv.lastDate}')">상세조회</button>
                </td>
            </tr>`;
        });
        
    } catch(err) {
        console.error("DEBUG: Fatal Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">치명적 에러: ${err.message}</td></tr>`;
    }
};

window.viewSentDetail = function(hotelName, month, sentAt) {
    alert(`${hotelName} 거래처의 ${month}월 정산 상세 내역은 첫 번째 탭인 '매출 및 경영 지표'에서 조회하실 수 있습니다.`);
};
