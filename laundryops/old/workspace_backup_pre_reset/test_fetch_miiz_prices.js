async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotel_item_prices?hotel_id=eq.h_1775579119077';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) { console.error(e); }
}
test();
