const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to ensure it.posQty is used everywhere in the special hotel HTML tables.
// I already replaced it. Let's do a double check.
let match = code.match(/<td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">\$\{it\.posQty\}<\/td>/g);
console.log("Matches of it.posQty in HTML:", match ? match.length : 0);

let matchExcel = code.match(/\? \[it\.name, it\.price, it\.posQty, it\.negQty !== 0 \? it\.negQty : '0', it\.price \* it\.netQty\]\n\s*: \[it\.name, it\.price, it\.posQty, it\.price \* it\.netQty\];/g);
console.log("Matches of it.posQty in Excel:", matchExcel ? matchExcel.length : 0);
