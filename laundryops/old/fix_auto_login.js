const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

// Ah! `window.initApp` is called on DOMContentLoaded.
// Does it call `loadGlobalNotice` if auto-logged in?
// Let's check `initApp`
for(let i=20; i<60; i++) {
    console.log(lines[i]);
}
