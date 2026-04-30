const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

// Ah, L1421 is `};` which closes `loadAdminHotelList`. (It's missing the `hotels.forEach(hId => {` brace?)
// The brace count before L1421 was 0.
// Then L1421 `};` made it -1.
// That means `window.loadAdminHotelList` lost its closing brace before L1421!
// Look at `window.loadAdminHotelList` starting around L1395.
for(let i=1390; i<1425; i++) {
    console.log(`L${i+1}: ${lines[i]}`);
}
