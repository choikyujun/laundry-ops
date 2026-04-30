const fs = require('fs');
async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoice_items?select=id,name,qty,price,invoice_id,invoices!inner(hotel_id, hotels(name, hotel_type))&invoices.hotels.hotel_type=eq.special&limit=10';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } });
    const data = await res.json();
    console.log("Special Hotel Invoice Items:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e); }
}
test();
