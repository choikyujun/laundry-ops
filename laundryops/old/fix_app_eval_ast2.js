const acorn = require('acorn');
const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i];
    if (node.loc.start.line <= 1800 && node.loc.end.line > 2000) {
        console.log("Node crossing 1800-2000 is type:", node.type, "lines:", node.loc.start.line, "-", node.loc.end.line);
    }
}
