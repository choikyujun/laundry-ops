const fs = require('fs');

let code = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

// There's a problem when invoice_items(qty, price) is requested on a table that is related, 
// wait, invoices and invoice_items are related. But invoice_items table name is invoice_items
// Actually, earlier today it threw an error because "could not find the 'items' column".
// Did I miss a join name or a field error? 

const oldSelect = ".select('id, date, is_sent, hotel_id, total_amount, updated_at, invoice_items(qty, price), hotels(name)')";
const newSelect = ".select('id, date, is_sent, hotel_id, total_amount, updated_at, hotels(name), invoice_items(qty, price)')";

code = code.replace(oldSelect, newSelect);
fs.writeFileSync('patch_sent_group_monthly.js', code);

console.log("Check if supabase query throws error");
