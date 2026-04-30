async function test() {
  const factoryId = 'f_1775578594982';
  const hotelId = 'h_1775579119077';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  const headers = { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` };

  const url = `https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=date,is_sent,updated_at,total_amount,invoice_items(qty,price)&factory_id=eq.${factoryId}&hotel_id=eq.${hotelId}&is_sent=eq.true`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(data);
}
test();
