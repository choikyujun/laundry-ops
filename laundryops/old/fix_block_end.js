const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

const regex = /const filteredData = data \? data\.filter\(inv => \!\(inv\.staff_name && inv\.staff_name\.startsWith\('관리자\(차감\)'\)\)\) \: \[\];\n\s*if \(filteredData\.length === 0\) \{\n\s*tbody\.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다\.<\/td><\/tr>';\n\s*_isInvoiceLoading = false;\n\s*return;\n\s*\}\n\n\s*tbody\.innerHTML = '';\n\s*filteredData\.forEach\(inv => \{[\s\S]*?\n\s*\}\n\};/;

code = code.replace(regex, (match) => {
    return match.replace(/}\n\};/, '} catch (e) {\n        console.error(e);\n        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;\n    } finally {\n        _isInvoiceLoading = false;\n    }\n};');
});

fs.writeFileSync('app_v38.js', code);
