async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?staff_name=eq.관리자';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ staff_name: '범..' })
    });
    const data = await res.json();
    console.log("Updated from 관리자 to 범..:", data.length);
  } catch(e) { console.error(e); }
}
test();
