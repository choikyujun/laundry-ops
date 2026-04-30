const key = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'; 
const url6 = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotels?select=*&limit=1';
fetch(url6, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }).then(res => res.json()).then(data => console.log('hotels(*)', data));
