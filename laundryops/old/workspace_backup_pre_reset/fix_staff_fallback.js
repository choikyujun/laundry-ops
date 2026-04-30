async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/staff?select=*';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    console.log("Staff list:", data);
  } catch(e) { console.error(e); }
}
test();
