const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

try {
  new Function(code);
  console.log("Syntax is OK!");
} catch(e) {
  console.log("Syntax Error:", e.message);
}
