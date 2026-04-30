// 패치 비활성화: app_v38.js 메인 로직 사용
window.loadAdminSentList = async function() { console.log("Disabled patch_sent_ungrouped"); };
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    try {
        const searchTerm = document.getElementById('adminSentSearch')?.value.toLowerCase() || '';
        
        // 1. Supabase에서 발송 완료 내역 조회
        const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, created_at, updated_at, hotel_id, is_sent, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">DB 에러: ${error.message}</td></tr>`;
            return;
        }

        const resultArr = [];
        
        // 그룹화 하지 않고, 각각의 명세서를 모두 개별 건으로 노출
        if (list && list.length > 0) {
            list.forEach(inv => {
                resultArr.push({
                    id: inv.id,
                    hotelId: inv.hotel_id,
                    hotelName: (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음',
                    period: inv.date, // 발송 기간(날짜)
                    totalAmount: inv.total_amount || 0,
                    lastSent: inv.updated_at || inv.created_at || inv.date,
                    source: 'db'
                });
            });
        }

        // 2. 로컬 스토리지 (구버전 백업 데이터) 병합
        const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(inv => {
                resultArr.push({
                    id: 'local_' + inv.sentAt,
                    hotelId: inv.hotelId || inv.hotelName,
                    hotelName: inv.hotelName || '알수없음',
                    period: inv.period || '알수없음',
                    totalAmount: inv.totalAmount || 0,
                    lastSent: inv.sentAt || new Date().toISOString(),
                    source: 'local'
                });
            });
        }

        // 검색 필터링
        const filteredArr = resultArr.filter(g => 
            g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)
        );

        if (filteredArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다. (새로 발송을 진행해주세요)</td></tr>';
            return;
        }

        // 최신순 정렬
        filteredArr.sort((a,b) => new Date(b.lastSent) - new Date(a.lastSent));

        // 페이지네이션
        window.adminSentPage = window.adminSentPage || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(filteredArr.length / itemsPerPage);
        if (window.adminSentPage > totalPages && totalPages > 0) window.adminSentPage = totalPages;

        const paginated = filteredArr.slice((window.adminSentPage - 1) * itemsPerPage, window.adminSentPage * itemsPerPage);

        tbody.innerHTML = '';
        paginated.forEach(inv => {
            const displayTotal = inv.totalAmount; 
            
            const sentDt = new Date(inv.lastSent);
            let dStr = isNaN(sentDt.getTime()) ? inv.lastSent : sentDt.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            // 개별 취소 기능 (DB 항목)
            const cancelBtn = inv.source === 'db' ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="cancelSingleInvoice('${inv.id}')">발송취소</button>` : '';

            tbody.innerHTML += `<tr>
                <td>${inv.period} ${inv.source==='local' ? '<small style="color:gray;">(구버전)</small>' : ''}</td>
                <td><strong>${inv.hotelName}</strong></td>
                <td>${displayTotal.toLocaleString()}원</td>
                <td>${dStr}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.period}', '${inv.lastSent}')">상세조회</button>
                    ${cancelBtn}
                </td>
            </tr>`;
        });
        
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">스크립트 에러: ${err.message}</td></tr>`;
    }
};

window.cancelSingleInvoice = async function(invId) {
    if(!confirm('이 명세서의 발송을 취소하시겠습니까?')) return;
    try {
        await window.mySupabase.from('invoices').update({ is_sent: false }).eq('id', invId);
        alert('발송 취소되었습니다.');
        window.loadAdminSentList();
    } catch(err) {
        alert('취소 실패: ' + err.message);
    }
};
