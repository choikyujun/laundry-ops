const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// The last instance of viewSentDetail is around line 10510.
// Let's strip everything after line 420 except the very first base code, 
// OR we just write a completely clean version. 
// It seems earlier I just concatenated files. 

// The safest way is to just replace the active window.viewSentDetail block entirely.
