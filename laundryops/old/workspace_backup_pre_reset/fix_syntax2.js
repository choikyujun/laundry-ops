const fs = require('fs');
try {
    const code = fs.readFileSync('app_v34.js', 'utf8');
    const vm = require('vm');
    new vm.Script(code);
    console.log("Syntax is OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
    const line = e.stack.split('\n')[0];
    console.error(line);
}
