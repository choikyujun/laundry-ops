const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const closingBraces = (code.match(/\{/g) || []).length;
const closingBrackets = (code.match(/\}/g) || []).length;

if (closingBraces > closingBrackets) {
    code += '\n' + '}'.repeat(closingBraces - closingBrackets);
}

fs.writeFileSync('app_v38.js', code);
