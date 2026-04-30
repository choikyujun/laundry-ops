const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// Ensure `login` is a global function
code = code.replace(/window\.login = async function\(\) {/g, 'window.login = async function() {\nconsole.log("Login clicked");\n');
code += '\n\nfunction login() { window.login(); }';

fs.writeFileSync('app_v38.js', code);
