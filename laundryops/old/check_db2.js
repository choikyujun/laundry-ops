const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
async function check() {
    const res = await fetch(`${supabaseUrl}/rest/v1/factories?admin_id=eq.cego&select=admin_id,admin_pw`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await res.json();
    console.log("Cego factory:", data);
}
check();
