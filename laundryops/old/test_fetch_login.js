const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';

async function test() {
    const lId = 'cego';
    const password = '861466';

    const url = `${supabaseUrl}/rest/v1/factories?admin_id=eq.${encodeURIComponent(lId)}&admin_pw=eq.${encodeURIComponent(password)}&select=*`;
    
    console.log("Fetching:", url);
    const res = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/vnd.pgrst.object+json' // maybeSingle equivalent
        }
    });
    
    if (res.ok) {
        const data = await res.json();
        console.log("Found:", data);
    } else {
        const err = await res.text();
        console.log("Error:", res.status, err);
    }
}
test();
