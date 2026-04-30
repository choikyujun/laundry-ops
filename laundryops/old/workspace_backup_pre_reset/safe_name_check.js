const fs = require('fs');
let code = fs.readFileSync('patch_v35_final_v3.js', 'utf8');

code = code.replace(/const invoiceItem = items\.find\(i => i\.name\.toLowerCase\(\) === ai\.name\.toLowerCase\(\)\);/g, 
"const invoiceItem = items.find(i => (i.name||'').toLowerCase() === (ai.name||'').toLowerCase());");

code = code.replace(/const foundInAll = allItems\.find\(ai => ai\.name\.toLowerCase\(\) === i\.name\.toLowerCase\(\)\);/g, 
"const foundInAll = allItems.find(ai => (ai.name||'').toLowerCase() === (i.name||'').toLowerCase());");

fs.writeFileSync('patch_v35_final_v3.js', code);
console.log("Safe name checks added");
