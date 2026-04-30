const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I see `if (filteredData.length === 0) { ... return; }`
// If it returns early, `window._lastInvoiceData` is not set or it returns undefined!
// Let's modify `return;` to `if (returnList) return []; else return;`

code = code.replace(
    /if \(\!data \|\| data\.length === 0\) \{\n\s*tbody\.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다\.<\/td><\/tr>';\n\s*_isInvoiceLoading = false;\n\s*return;\n\s*\}/g,
    `if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }`
);

code = code.replace(
    /if \(filteredData\.length === 0\) \{\n\s*tbody\.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다\.<\/td><\/tr>';\n\s*_isInvoiceLoading = false;\n\s*return;\n\s*\}/g,
    `if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }`
);

fs.writeFileSync('app_v38.js', code);
