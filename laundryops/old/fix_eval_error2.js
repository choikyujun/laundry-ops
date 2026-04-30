const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I accidentally deleted `const modal = document.getElementById('hotelModal'), title = ..., btn = ...;`
// Let's replace line 5446 with the proper declaration!
code = code.replace(
    /    const modal = document\.getElementById\('hotelModal'\),\n    document\.getElementById\('h_fixedAmountGroup'\)/g,
    `    const modal = document.getElementById('hotelModal');
    const title = modal.querySelector('h3');
    const btn = modal.querySelector('.btn-save');
    document.getElementById('h_fixedAmountGroup')`
);

fs.writeFileSync('app_v38.js', code);
