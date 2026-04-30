const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    const res = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id,staff_name&staff_name=like.관리자(차감)%25&limit=10`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await res.json();
    console.log(data);
}
test();
