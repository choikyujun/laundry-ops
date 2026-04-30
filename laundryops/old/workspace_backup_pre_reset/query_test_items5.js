const key = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'; 
const url6 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/factory_items?select=*&limit=1';
fetch(url6, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('factory_items', data));

const url7 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotel_item_prices?select=*&limit=1';
fetch(url7, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('hotel_item_prices', data));
