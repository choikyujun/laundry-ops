const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
console.log("window.login = async function:", code.includes('window.login = async function'));
console.log("Lines in file:", code.split('\n').length);
