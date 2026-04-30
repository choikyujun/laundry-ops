const vm = require('vm');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// The file executes without error, but variables aren't globally attached.
// This is because the code might be getting truncated?
// Or because JS engine sees block `try {` and misses the rest?
console.log("File length:", code.length);

// Let's print out what we see in `sandbox`
const sandbox = {
    window: { addEventListener: () => {} },
    document: {
        getElementById: () => ({}),
        querySelectorAll: () => []
    },
    console: console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve({ json: () => ({}) })
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

let found = [];
for(let k in sandbox.window) found.push(k);
console.log("Last 5 items on window:", found.slice(-5));
