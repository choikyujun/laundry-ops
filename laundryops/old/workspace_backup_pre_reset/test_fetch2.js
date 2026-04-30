async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,factory_id,date,hotel_id&limit=5';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
  const data = await res.json();
  console.log("Invoices factory_id sample:", JSON.stringify(data, null, 2));
}
test();
