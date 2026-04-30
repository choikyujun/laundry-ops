async function test() {
  const factoryId = 'f_1775578594982';
  const hotelId = 'h_1775579119077';
  const apiKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
  const headers = { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` };

  const urlF = `https://tphagookafjldzvxaxui.supabase.co/rest/v1/factories?id=eq.${factoryId}&select=*`;
  const resF = await fetch(urlF, {headers});
  console.log("F:", await resF.json());

  const urlH = `https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotels?id=eq.${hotelId}&select=*`;
  const resH = await fetch(urlH, {headers});
  console.log("H:", await resH.json());
}
test();
