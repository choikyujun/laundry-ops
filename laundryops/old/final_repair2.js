const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// If the line starts with // [DEDUPE REMOVED], the `async function` is commented out!
// The engine sees `// [DEDUPE REMOVED] window.viewSentDetail = async function /*OLD*/ ...`
// So the `await` on the NEXT line is bare.
// We must NOT comment out the function signature if we leave the body intact.
// We must just rename the function variable assignment.

code = code.replace(/\/\/ \[DEDUPE REMOVED\] (window\.[a-zA-Z0-9_]+) \= async function \/\*OLD\*\/\s*\/\*\s*DUMMY ASYNC\s*\*\/\s*/g, (match, p1) => {
    return p1 + '_OLD = async function ';
});

fs.writeFileSync('app_v38.js', code);
