const fs = require('fs');

let code = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

const oldLogic = `        const f = platformData.factories[currentFactoryId];
        if (!f || !f.sentInvoices || f.sentInvoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 월정산 내역이 없습니다.</td></tr>';
            return;
        }

        const resultArr = f.sentInvoices.filter(inv =>
            (inv.hotelName || '').toLowerCase().includes(searchTerm) || (inv.period || '').includes(searchTerm)
        );`;

const newLogic = `        let f = platformData.factories[currentFactoryId];
        if (!f) {
            platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {} };
            f = platformData.factories[currentFactoryId];
        }
        
        let resultArr = [];
        if (f && f.sentInvoices) {
            resultArr = f.sentInvoices.filter(inv =>
                (inv.hotelName || '').toLowerCase().includes(searchTerm) || (inv.period || '').includes(searchTerm)
            );
        }

        // DB에서 최신 발송 내역과 조합하여 "발송 그룹"을 묶어내기 (과거 로컬 데이터가 날아갔을 경우를 대비)
        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);
            
        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                if(!dbGrouped[key]) {
                    dbGrouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                dbGrouped[key].totalAmount += (Number(inv.total_amount) || 0);
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });
            
            // 로컬 데이터(resultArr)에 없는 DB 발송 그룹만 추가
            Object.values(dbGrouped).forEach(g => {
                const exists = resultArr.find(r => r.hotelName === g.hotelName && r.period.includes(g.period));
                if (!exists) {
                    if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                        resultArr.push(g);
                    }
                }
            });
        }

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 월정산 내역이 없습니다.</td></tr>';
            return;
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_sent_group_monthly.js', code);
console.log("Patched loadAdminSentList for db fallback groups");
