window.loadAdminSentList = async function() {
    console.log("DEBUG loadAdminSentList: START");
    const tbody = document.getElementById('adminSentList');
    if(!tbody) { console.log("DEBUG: NO TBODY"); return; }
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송 내역을 불러오는 중...</td></tr>';

    try {
        const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, created_at, hotel_id, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);

        console.log("DEBUG: DB list:", list, "Error:", error);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`;
            return;
        }

        const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
        let localSent = [];
        if (f && f.sentInvoices) localSent = f.sentInvoices;

        console.log("DEBUG: Local list:", localSent);

        if ((!list || list.length === 0) && localSent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다.</td></tr>';
            return;
        }

        const grouped = {};
        if (list) {
            list.forEach(inv => {
                const month = (inv.date || 'YYYY-MM').substring(0, 7); 
                const key = 'db_' + inv.hotel_id + '_' + month;
                if(!grouped[key]) {
                    grouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: inv.hotels ? inv.hotels.name : '알수없음',
                        month: month,
                        totalAmount: 0,
                        lastSent: inv.created_at || inv.date,
                        count: 0,
                        source: 'db'
                    };
                }
                grouped[key].totalAmount += (inv.total_amount || 0);
                grouped[key].count += 1;
            });
        }

        localSent.forEach(inv => {
            const month = inv.period ? inv.period.substring(0, 7) : '알수없음';
            const key = 'local_' + inv.hotelName + '_' + month;
            if(!grouped[key]) {
                grouped[key] = {
                    hotelId: inv.hotelId || inv.hotelName,
                    hotelName: inv.hotelName,
                    month: month,
                    totalAmount: 0,
                    lastSent: inv.sentAt,
                    count: 1,
                    source: 'local'
                };
            }
            grouped[key].totalAmount += (inv.totalAmount || 0);
        });

        console.log("DEBUG: grouped:", grouped);

        const resultArr = Object.values(grouped);
        resultArr.sort((a,b) => new Date(b.lastSent) - new Date(a.lastSent));

        tbody.innerHTML = '';
        resultArr.forEach(inv => {
            const displayTotal = inv.source === 'db' ? Math.round(inv.totalAmount * 1.1) : inv.totalAmount;
            const sentDt = new Date(inv.lastSent);
            let dStr = isNaN(sentDt.getTime()) ? inv.lastSent : sentDt.toLocaleString('ko-KR');

            tbody.innerHTML += `<tr>
                <td>${inv.month} ${inv.source==='local' ? '(구버전)' : ''}</td>
                <td><strong>${inv.hotelName}</strong> <small>(${inv.count}건)</small></td>
                <td>${displayTotal.toLocaleString()}원</td>
                <td>${dStr}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.month}', '${inv.lastSent}')">상세조회</button>
                </td>
            </tr>`;
        });
        console.log("DEBUG: END loadAdminSentList");
    } catch(err) {
        console.error("DEBUG FATAL:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">치명적 에러: ${err.message}</td></tr>`;
    }
};
