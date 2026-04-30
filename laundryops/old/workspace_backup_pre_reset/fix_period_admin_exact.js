const fs = require('fs');
let code = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

const oldLogic = `        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                if(!dbGrouped[key]) {
                    dbGrouped[key] = {
                        minDate: inv.date,
                        maxDate: inv.date,
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                } else {
                    if (inv.date < dbGrouped[key].minDate) dbGrouped[key].minDate = inv.date;
                    if (inv.date > dbGrouped[key].maxDate) dbGrouped[key].maxDate = inv.date;
                }
                
                // 실제 공급가(단가 x 수량) 계산
                const items = inv.invoice_items || [];
                const supplyPrice = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[key].totalAmount += supplyPrice;
                
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
                
                dbGrouped[key].period = dbGrouped[key].minDate + ' ~ ' + dbGrouped[key].maxDate;
            });
            
            Object.values(dbGrouped).forEach(g => {
                if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                    resultArr.push(g);
                }
            });
        }`;

const newLogic = `        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                if(!dbGrouped[key]) {
                    const [y, m] = month.split('-');
                    const lastDay = new Date(y, m, 0).getDate();
                    dbGrouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: \`\${month}-01 ~ \${month}-\${lastDay}\`, // Default
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                
                const items = inv.invoice_items || [];
                const supplyPrice = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[key].totalAmount += supplyPrice;
                
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });

            // Recover exact period from local data if available
            let f = null;
            if (typeof platformData !== 'undefined' && platformData.factories) {
                f = platformData.factories[currentFactoryId];
            } else {
                const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
                if (pData && pData.factories) f = pData.factories[currentFactoryId];
            }
            if (f && f.sentInvoices && f.sentInvoices.length > 0) {
                f.sentInvoices.forEach(localInv => {
                    const localMonth = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (localMonth) {
                        const key = localInv.hotelId + '_' + localMonth;
                        if (dbGrouped[key]) {
                            dbGrouped[key].period = localInv.period;
                        }
                    }
                });
            }
            
            Object.values(dbGrouped).forEach(g => {
                if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                    resultArr.push(g);
                }
            });
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_sent_group_monthly.js', code);
console.log("Patched admin exact period fallback");
