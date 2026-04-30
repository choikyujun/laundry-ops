// 1. 발송 내역 조회 (회차별 관리 - DB Only)
// Patch: v35_group_monthly 로직(Legacy)
window.loadAdminSentList_Legacy = async function() { console.log("Disabled patch_sent_group_monthly"); };
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    try {
        const searchTerm = document.getElementById('adminSentSearch')?.value.toLowerCase() || '';

        // DB에서 발송된 내역 조회 (is_sent = true)
        const { data: dbSent, error } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, sent_group_id, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true)
            .order('date', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        const groups = {};
        dbSent.forEach(inv => {
            // sent_group_id가 있으면 그걸 그룹ID로, 없으면 'old_호텔ID_날짜'로 취급
            const gId = inv.sent_group_id || (`old_${inv.hotel_id}_${inv.date}`);
            
            let min, max;
            if (inv.sent_group_id && inv.sent_group_id.startsWith('g_')) {
                const parts = inv.sent_group_id.split('_');
                // g_2026-04-01_2026-04-15_123 -> parts[1]=2026-04-01, parts[2]=2026-04-15
                min = parts[1];
                max = parts[2];
            } else {
                min = inv.date;
                max = inv.date;
            }
            
            if(!groups[gId]) {
                groups[gId] = {
                    id: gId,
                    hotelId: inv.hotel_id,
                    hotelName: inv.hotels?.name || '알수없음',
                    minDate: min,
                    maxDate: max,
                    totalAmount: 0
                };
            }
            groups[gId].totalAmount += (inv.total_amount || 0);
            
            // 만약 old 데이터라면 날짜 범위 계속 추적
            if (gId.startsWith('old_')) {
                if(inv.date < groups[gId].minDate) groups[gId].minDate = inv.date;
                if(inv.date > groups[gId].maxDate) groups[gId].maxDate = inv.date;
            }
        });

        // 렌더링
        const resultArr = Object.values(groups).filter(g => 
            g.hotelName.toLowerCase().includes(searchTerm)
        );

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        resultArr.forEach(g => {
            const period = `${g.minDate} ~ ${g.maxDate}`;
            tbody.innerHTML += `<tr>
                <td>${period}</td>
                <td><strong>${g.hotelName}</strong></td>
                <td style="text-align:right;">${g.totalAmount.toLocaleString()}원</td>
                <td>${g.maxDate}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:4px;" onclick="viewSentDetailByGroup('${g.hotelName}', '${period}')">상세보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="cancelMonthlyInvoiceByGroup('${g.id}')">발송취소</button>
                </td>
            </tr>`;
        });

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${err.message}</td></tr>`;
    }
};

window.viewSentDetailByGroup = async function(hotelName, period) {
    const { data: hotels } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).eq('name', hotelName);
    const h = hotels && hotels.length > 0 ? hotels[0] : null;
    if (!h) { alert('거래처 정보를 찾을 수 없습니다.'); return; }

    await window.viewSentDetail(hotelName, period, period.split(' ~ ')[1], false);
};

// 2. 발송 취소 로직 (DB 기반)
window.cancelMonthlyInvoiceByGroup = async function(groupId) {
    if(!confirm('이 발송 내역을 취소하시겠습니까?')) return;

    try {
        let query = window.mySupabase.from('invoices').update({ is_sent: false, sent_group_id: null });
        
        if (groupId.startsWith('old_')) {
            const parts = groupId.split('_');
            query = query.eq('hotel_id', parts[1]).eq('date', parts[2]);
        } else {
            query = query.eq('sent_group_id', groupId);
        }

        const { error } = await query.eq('is_sent', true);
        if(error) throw error;

        alert('취소되었습니다.');
        window.loadAdminSentList();
        if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices(); 
    } catch(err) {
        alert('취소 실패: ' + err.message);
    }
};
