const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('invoices')
        .select('id, staff_name')
        .not('staff_name', 'like', '관리자(차감)%')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(data, error);
}
run();
