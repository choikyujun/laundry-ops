async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,date,hotel_id,invoice_items(name,qty,price)&limit=50';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    console.log(data);
  } catch(e) { console.error(e); }
}
test();
