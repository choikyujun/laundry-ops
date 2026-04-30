const acorn = require('acorn');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });

let target = ast.body.find(n => n.loc.start.line === 1821);
// Let's dump all functions declared inside loadAdminStaffList
const estraverse = require('estraverse');
estraverse.traverse(target, {
    enter: function(node) {
        if (node.type === 'AssignmentExpression' && node.left.property && node.left.property.name) {
            console.log("Assigned:", node.left.property.name, "at line", node.loc.start.line);
        }
    }
});
