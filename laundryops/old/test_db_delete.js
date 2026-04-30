const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    // Delete that bad invoice
    const res = await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.inv_1776566669483`, {
        method: 'DELETE',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    console.log("Deleted bad invoice", res.status);
}
test();
