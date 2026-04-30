const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    const res = await fetch(`${supabaseUrl}/rest/v1/sent_logs?id=eq.cbb4f40b-d44a-41af-9a8a-7c9551a725db`, {
        method: 'DELETE',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    console.log("Deleted orphan sent log", res.status);
}
test();
