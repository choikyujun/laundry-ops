const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

for(let i=1480; i<1515; i++) {
    console.log(`L${i+1}: ${lines[i]}`);
}
