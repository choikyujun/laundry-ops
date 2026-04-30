const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I notice `window.loadAdminStaffList` is the last one defined before `window.login`?
// No, wait. The last one printed was `loadAdminStaffList`.
// Let's check where `loadAdminStaffList` is defined.
console.log("loadAdminStaffList pos:", code.indexOf('window.loadAdminStaffList ='));
console.log("login pos:", code.indexOf('window.login ='));

// Oh! Did the file execution stop early due to an error, so the rest of the functions weren't evaluated?
// Let's run it with error tracking on vm.
