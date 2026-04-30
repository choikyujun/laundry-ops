const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// replace the incorrect period string generation with finding the first and last day of the month
// because the user wants "2026-04-01 ~ 2026-04-11" (or last day of the month).
// Wait, if it's "2026-04-01 ~ 2026-04-11", it's what they selected when they clicked "Send".
// The problem is that when we fetch from DB purely by `is_sent=true` and group by month,
// we lose the original `sDate` and `eDate` they picked from the calendar.
// The easiest fix is to read the exact period from the local storage history `sentInvoices` IF IT EXISTS.
// If it doesn't, we fallback to 1st of month ~ last day of month.

const oldLogic = `        // 100% DB Driven
        const { data: list } = await window.mySupabase.from('invoices')
            .select('date, is_sent, updated_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        const dbGrouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    dbGrouped[month] = {
                        minDate: inv.date,
                        maxDate: inv.date,
                        totalAmount: 0,
                        sentAt: inv.created_at || inv.date || new Date().toISOString(),
                        source: 'db'
                    };
                } else {
                    if (inv.date < dbGrouped[month].minDate) dbGrouped[month].minDate = inv.date;
                    if (inv.date > dbGrouped[month].maxDate) dbGrouped[month].maxDate = inv.date;
                }
                
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[month].totalAmount += supplyPrice;
                if(new Date(inv.created_at || inv.date) > new Date(dbGrouped[month].sentAt)) {
                    dbGrouped[month].sentAt = inv.created_at || inv.date;
                }
                
                dbGrouped[month].period = dbGrouped[month].minDate + ' ~ ' + dbGrouped[month].maxDate;
            });
        }`;

const newLogic = `        // 100% DB Driven
        const { data: list } = await window.mySupabase.from('invoices')
            .select('date, is_sent, created_at, updated_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        const dbGrouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    const [y, m] = month.split('-');
                    const lastDay = new Date(y, m, 0).getDate();
                    
                    dbGrouped[month] = {
                        period: \`\${month}-01 ~ \${month}-\${lastDay}\`, // Default month range
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.created_at || inv.date || new Date().toISOString(),
                        source: 'db'
                    };
                } 
                
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[month].totalAmount += supplyPrice;
                if(new Date(inv.updated_at || inv.created_at || inv.date) > new Date(dbGrouped[month].sentAt)) {
                    dbGrouped[month].sentAt = inv.updated_at || inv.created_at || inv.date;
                }
            });
        }
        
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
                if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
                    const localMonth = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (localMonth && dbGrouped[localMonth]) {
                        // Override default period with exact user selection
                        dbGrouped[localMonth].period = localInv.period;
                    }
                }
            });
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Patched partner period");
