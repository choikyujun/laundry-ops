const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to safely remove the stray code block that starts with `          title = modal.querySelector('h3'),`
code = code.replace(/          title = modal\.querySelector\('h3'\),[\s\S]*?document\.getElementById\('h_contractType'\)\.value = 'unit';\n/g, '');

fs.writeFileSync('app_v38.js', code);
