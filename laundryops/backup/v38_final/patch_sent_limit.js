const fs = require('fs');

let content = fs.readFileSync('patch_sent_ungrouped_fix.js', 'utf8');

const oldQuery = `const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, created_at, hotel_id, is_sent, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);`;

const newQuery = `const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, created_at, hotel_id, is_sent, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true)
            .order('date', { ascending: false })
            .limit(100); // [Fix] 최근 100건만 조회하여 너무 많은 데이터 노출 방지`;

if(content.includes(oldQuery)) {
    content = content.replace(oldQuery, newQuery);
    fs.writeFileSync('patch_sent_ungrouped_fix.js', content);
    console.log("Limit 100 applied to adminSentList.");
} else {
    console.log("Could not find query to limit.");
}
