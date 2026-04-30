const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id,invoice_items(name,qty)&limit=10`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
check();
