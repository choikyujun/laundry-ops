const url = 'https://tphagookafjldzvxaxui.supabase.co/rest/v1/hotels?select=*&limit=5';
const key = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq'; 
fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data[0], null, 2)))
  .catch(err => console.error(err));
