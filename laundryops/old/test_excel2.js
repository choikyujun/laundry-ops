const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/hotel_item_prices?select=name,hotel_id`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await res.json();
    console.log(data);
}
check();
