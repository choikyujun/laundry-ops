const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
const tables = [
    'invoice_items', 'sent_logs', 'invoices', 'hotel_item_prices', 
    'hotel_categories', 'factory_default_prices', 'hotels', 'staff', 
    'factories', 'approved_payments', 'pending_payments', 'pending_factories'
];
async function checkDB() {
    for (const table of tables) {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const data = await res.json();
        console.log(`${table}: ${data.length > 0 ? 'NOT EMPTY' : 'EMPTY'}`);
    }
}
checkDB();
