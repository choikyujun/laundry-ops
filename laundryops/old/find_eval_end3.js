const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to see where exactly it stops parsing properties on window.
const acorn = require('acorn');
try {
    let ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
    // Let's traverse top-level body and find where `login` assignment is
    let lastNode = ast.body[ast.body.length - 1];
    console.log("Last AST node type:", lastNode.type, "loc:", lastNode.loc.start.line);
} catch(e) {
    console.log("Acorn error:", e.message, e.loc);
}
