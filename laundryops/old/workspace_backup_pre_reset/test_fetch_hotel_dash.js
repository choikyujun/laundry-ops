async function test() {
  const factoryId = 'f_1775578594982';
  const hotelId = 'h_1775579119077';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  const headers = { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` };

  const { data: list } = await fetch(`https://tphagookafjldzvxaxui.supabase.co/rest/v1/invoices?select=id,date,invoice_items(name,qty,price)&factory_id=eq.${factoryId}&hotel_id=eq.${hotelId}&order=date.desc`, {headers}).then(r => r.json()).then(d => ({data: d}));
  
  const sMonth = '2026-04';
  let total = 0, count = 0;
  const itemStats = {};
  const monthlyTrend = {};

  if(list) {
      list.forEach(inv => {
          const items = inv.invoice_items || [];
          const invSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
          
          if(inv.date.startsWith(sMonth)) {
              total += invSum; 
              count++; 
              items.forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty||0));
          }
          const mKey = inv.date.substring(0, 7);
          if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += invSum;
      });
  }
  console.log("Total:", total, "Count:", count, "itemStats:", itemStats);
}
test();
