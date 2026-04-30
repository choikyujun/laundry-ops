async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,date,total_amount,hotel_id,hotels!inner(name,contract_type,fixed_amount)&limit=10';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) { console.error(e); }
}
test();
