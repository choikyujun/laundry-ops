const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// We need the supabase url and key. Let's find it from app_v40.js
const appCode = fs.readFileSync('app_v40.js', 'utf-8');
const urlMatch = appCode.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = appCode.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    async function run() {
        const {data, error} = await supabase.from('invoices').select('id, date, total_amount, invoice_items(name, qty, price)').limit(5);
        console.log("Invoices:", data);
    }
    run();
} else {
    console.log("Creds not found");
}
