const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

const tables = [
    'invoice_items',
    'sent_logs',
    'invoices',
    'hotel_item_prices',
    'hotel_categories',
    'factory_default_prices',
    'hotels',
    'staff',
    'factories',
    'approved_payments',
    'pending_payments',
    'pending_factories'
];

async function resetDB() {
    for (const table of tables) {
        console.log(`Deleting data from ${table}...`);
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=not.is.null`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        if (!res.ok) {
            // try another column or check error
            const err = await res.text();
            console.error(`Error deleting from ${table}:`, res.status, err);
        } else {
            console.log(`Deleted from ${table}`);
        }
    }
    console.log('Done!');
}
resetDB();
