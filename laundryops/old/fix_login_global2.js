const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// Are both `function login() { window.login(); }` global?
// Wait, `function login()` declarations inside a JS script tag are global. 
// BUT if the browser sees `login` in the `onclick="login()"` of a `<form>` or `<input>`, it might resolve to something else if the name clashes.
// However, earlier we had `window.login()` inside the HTML and it said `window.login is not a function`.

// Wait... Why did `window.login()` say "not a function" at 14:42 ?
// Because `window.login` was `undefined` or something, probably due to a syntax error or the function didn't register.
// But now `test_eval_final.js` shows `window.login` IS a function!
