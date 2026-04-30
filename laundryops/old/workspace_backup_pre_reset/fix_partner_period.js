const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

const oldLogic = `        // 100% DB Driven
        const { data: list } = await window.mySupabase.from('invoices')
            .select('date, is_sent, created_at, total_amount, invoice_items(qty, price)')
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
        const { data: list, error: dbErr } = await window.mySupabase.from('invoices')
            .select('date, is_sent, created_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        if (dbErr) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">에러: ' + dbErr.message + '</td></tr>';
            return;
        }

        const dbGrouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    const [y, m] = month.split('-');
                    const lastDay = new Date(y, m, 0).getDate();
                    dbGrouped[month] = {
                        period: \`\${month}-01 ~ \${month}-\${lastDay}\`,
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

if(code.includes('minDate')) {
    code = code.replace(oldLogic, newLogic);
    fs.writeFileSync('patch_partner_dashboard_v35.js', code);
    console.log("Patched partner period bug");
}
