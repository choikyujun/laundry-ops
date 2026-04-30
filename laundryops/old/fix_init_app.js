const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// Also, what if the user logs in normally?
// `window.login` saves `currentFactoryId` to `localStorage`.
// Next time the user refreshes the page, how does it auto-login?
// Wait, `app.js` is the main file that handles the page loading and normal auto-login via `localStorage.getItem('currentFactoryId')`!!
// Yes! `app.js` calls `loadAdminDashboard()` etc.
// But `app.js` doesn't know about `loadGlobalNotice()`!

// We must add `window.loadGlobalNotice()` to `window.loadAdminDashboard()` so it always loads!
// And `loadStaffDashboard` and `loadHotelDashboard`!
code = code.replace(
    /window\.loadAdminDashboard = async function\(\) \{/,
    `window.loadAdminDashboard = async function() {\n    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();`
);

code = code.replace(
    /window\.loadStaffDashboard = async function\(\) \{/,
    `window.loadStaffDashboard = async function() {\n    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();`
);

code = code.replace(
    /window\.loadHotelDashboard = async function\(\) \{/,
    `window.loadHotelDashboard = async function() {\n    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();`
);

fs.writeFileSync('app_v38.js', code);
