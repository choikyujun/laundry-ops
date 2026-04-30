async function test() {
  const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,date,total_amount,created_at,hotel_id,is_sent,hotels(name)&is_sent=eq.true&limit=5';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await res.json();
    console.log("Invoices data:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
