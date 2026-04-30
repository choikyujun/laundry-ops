const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to add '}' at the end ? 
// Node error says: Unexpected end of input
// Let's count {} 
