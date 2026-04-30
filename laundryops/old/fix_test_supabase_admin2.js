const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    const res = await fetch(`${supabaseUrl}/rest/v1/sent_logs?select=id,period&limit=10`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await res.json();
    console.log(data);
}
test();
