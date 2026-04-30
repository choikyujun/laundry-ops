const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I made `login` explicitly `window.login`.
// Let's ensure that `window.login` is attached correctly and test it again.
// Wait, `window.login` returned `undefined` in the vm sandbox.
// Let's check WHY.
const vm = require('vm');
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

console.log("Keys in window:", Object.keys(sandbox.window).length);
// Why is login undefined? Is it possible that the file throws or returns early?
// Check if the script throws or halts.
console.log(Object.keys(sandbox.window));
