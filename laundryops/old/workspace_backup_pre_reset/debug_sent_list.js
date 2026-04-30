const fs = require('fs');

let code = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

// There might be a bug with how resultArr is defined and used.
// It seems `resultArr` is defined locally inside the if block, or not defined at all.

const currentLogic = `        let resultArr = [];
        
        // 100% DB Driven (is_sent = true)
        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, invoice_items(qty, price), hotels(name)')
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
                
                // 실제 공급가(단가 x 수량) 계산
                const items = inv.invoice_items || [];
                const supplyPrice = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[key].totalAmount += supplyPrice;
                
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });
            
            Object.values(dbGrouped).forEach(g => {
                if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                    resultArr.push(g);
                }
            });
        }`;

// Check if there is another error after this block:
/*
        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 월정산 내역이 없습니다.</td></tr>';
            return;
        }
*/

