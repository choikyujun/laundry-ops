const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

// Why is it undefined now?? 
// Oh, the AST search earlier told me: "Node crossing 1800-2000 is type: ExpressionStatement lines: 1425 - 7347"
// That means `window.loadAdminStaffList` ENCLOSES everything up to line 7347!!
// Which means `window.login` is declared INSIDE `loadAdminStaffList` !!

// Let's verify:
console.log(lines[1424]); // should be window.loadAdminStaffList = async function() {
console.log(lines[7346]); // should be }

// If so, we need to CLOSE the brace where it actually ends!
