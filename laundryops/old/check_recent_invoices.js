const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    const res = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id,date,staff_name,hotel_id&order=created_at.desc&limit=5`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await res.json();
    console.log("Recent Invoices:", data);

    const res2 = await fetch(`${supabaseUrl}/rest/v1/sent_logs?select=id,period,total_amount,hotel_id&order=sent_at.desc&limit=5`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data2 = await res2.json();
    console.log("Recent Sent Logs:", data2);
}
test();
