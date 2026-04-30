const url1 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotel_items?select=*&limit=1';
const key = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'; 
fetch(url1, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('hotel_items', data));

const url2 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/items?select=*&limit=1';
fetch(url2, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('items', data));

const url3 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/categories?select=*&limit=1';
fetch(url3, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('categories', data));
