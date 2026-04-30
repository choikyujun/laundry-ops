const acorn = require('acorn');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

let lastNode = ast.body[ast.body.length - 1];
console.log("Last parsed node type:", lastNode.type, "Starts at line:", lastNode.loc.start.line);

// The file parses correctly, but variables aren't attaching to window.
// Wait! `window` is inside a block?
// Let's check the very first AST node. If the first AST node is a BlockStatement or FunctionDeclaration or TryStatement containing everything!
let firstNode = ast.body.find(n => n.type === 'TryStatement');
if (firstNode) {
    console.log("Found TryStatement at top level. Lines:", firstNode.loc.start.line, "-", firstNode.loc.end.line);
}
