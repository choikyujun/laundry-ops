const fs = require('fs');

let code = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

// Insert a console.log to catch the error
code = code.replace(
`        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, invoice_items(qty, price), hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);`,
`        const { data: dbSent, error: dbError } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, hotels(name), invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);
            
        if (dbError) {
            console.error("DEBUG adminSentList query error:", dbError);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">에러: ' + dbError.message + '</td></tr>';
            return;
        }`);

fs.writeFileSync('patch_sent_group_monthly.js', code);
console.log("Added dbError log");
