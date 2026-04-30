const key = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'; 
const url4 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/price_settings?select=*&limit=1';
fetch(url4, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('price_settings', data));

const url5 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotel_prices?select=*&limit=1';
fetch(url5, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('hotel_prices', data));
