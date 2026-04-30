const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

let braceCount = 0;
for(let i=0; i<1515; i++) {
    let l = lines[i] || "";
    let open = (l.match(/\{/g) || []).length;
    let close = (l.match(/\}/g) || []).length;
    braceCount += open - close;
    if (braceCount < 0) {
        console.log(`Negative brace count at L${i+1} [${braceCount}]: ${l}`);
    }
}

// Actually if there's a negative brace count, it means we have TOO MANY CLOSING BRACES somewhere.
