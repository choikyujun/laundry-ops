const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetDB() {
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

    for (const table of tables) {
        console.log(`Deleting data from ${table}...`);
        const { data, error } = await supabase.from(table).delete().neq('id', 'dummy_value_to_delete_all');
        if (error) {
            console.error(`Error deleting from ${table}:`, error.message);
        } else {
            console.log(`Deleted from ${table}`);
        }
    }
    console.log('Done!');
}
resetDB();
