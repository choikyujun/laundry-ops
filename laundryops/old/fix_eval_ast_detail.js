const acorn = require('acorn');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

let target = ast.body.find(n => n.loc.start.line === 1821);
console.log("target expression type:", target.expression.type);

// If it's an assignment, let's see its right side.
if (target.expression.type === 'AssignmentExpression') {
    const rhs = target.expression.right;
    console.log("RHS type:", rhs.type, "Ends at:", rhs.loc.end.line);
}
