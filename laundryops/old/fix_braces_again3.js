const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// The `loadAdminStaffList` ends at 1501 with `};`.
// Wait, `loadAdminStaffList` begins at 1425 with `window.loadAdminStaffList = async function() {`.
// That is 1 opening brace.
// So if braceCount was 0 at 1424, and 1 at 1425, and -1 at 1501, it means we CLOSED 2 TOO MANY!
// Let's trace inside `loadAdminStaffList` (lines 1425-1501).

const lines = code.split('\n');
let count = 0;
for(let i=1424; i<1502; i++) {
    let l = lines[i] || "";
    let open = (l.match(/\{/g) || []).length;
    let close = (l.match(/\}/g) || []).length;
    count += open - close;
    console.log(`L${i+1} [${count}]: ${l}`);
}
