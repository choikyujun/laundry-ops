const fs = require('fs');
let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// We need min_date and max_date for each month group.

const oldLogic = `        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    dbGrouped[month] = {
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.created_at || inv.date || new Date().toISOString(),
                        source: 'db'
                    };
                }
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[month].totalAmount += supplyPrice;
                if(new Date(inv.created_at || inv.date) > new Date(dbGrouped[month].sentAt)) {
                    dbGrouped[month].sentAt = inv.created_at || inv.date;
                }
            });
        }`;

const newLogic = `        if (list && list.length > 0) {
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

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Patched period string");
