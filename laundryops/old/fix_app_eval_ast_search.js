const acorn = require('acorn');
const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

let n = ast.body.find(n => n.loc.start.line === 1425);
console.log("node at 1425 is", n.type, "ends at", n.loc.end.line);
