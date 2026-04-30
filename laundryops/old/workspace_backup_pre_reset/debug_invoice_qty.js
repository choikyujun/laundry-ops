const { createClient } = require('@supabase/supabase-js');
// we only have fetch
async function test() {
  const hotelId = 'h_1775579119077';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  const headers = { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` };

  // Fetch invoices for Miiz hotel
  let url = `https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,date,total_amount,invoice_items(name,qty,price)&hotel_id=eq.${hotelId}&order=date.asc`;
  let res = await fetch(url, { headers });
  let invoices = await res.json();
  
  // Console logging exact quantities
  invoices.forEach(inv => {
    console.log(`\n--- Invoice Date: ${inv.date} ---`);
    inv.invoice_items.forEach(it => {
        console.log(`[${it.name}] Qty: ${it.qty} (Price: ${it.price})`);
    });
  });
}
test();
