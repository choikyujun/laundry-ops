const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

console.log("window.login exists?", code.includes('window.login ='));
console.log("lines in file:", code.split('\n').length);
