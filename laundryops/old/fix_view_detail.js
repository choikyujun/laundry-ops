const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// What if the user didn't select 'all' dates? The `gte` and `lte` could miss the deduction invoice if it's outside.
// The deduction invoice has `date: eDate`, so it should be included.
// What about the name check?
// Let's print out what we see in `filteredList.forEach`.
code = code.replace(
    /filteredList\.forEach\(inv => \{\n\s*\(inv\.invoice_items \|\| \[\]\)\.forEach\(it => \{\n\s*if \(\!it\.name \|\| it\.name\.trim\(\) === ''\) return;\n\s*let isMonthlyDeduction = inv\.staff_name && inv\.staff_name\.startsWith\('관리자\(차감\)'\) \|\| it\.name\.includes\('\(차감\)'\) \|\| it\.name\.includes\('\(클레임차감\)'\);\n\s*let cleanName = it\.name\.replace\(' \(차감\)', ''\)\.replace\(' \(클레임차감\)', ''\)\.trim\(\);/g,
    `filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();`
);

// We should also verify if the staff_name comparison was correct:
// `return inv.staff_name === '관리자(차감)_' + sentLogId;`
// This is exactly how we set it: `staff_name: '관리자(차감)_' + newLog.id`

fs.writeFileSync('app_v38.js', code);
