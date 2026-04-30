const vm = require('vm');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const sandbox = {
    window: { addEventListener: () => {}, location: { hash: '' } },
    document: { getElementById: () => ({}), querySelectorAll: () => [] },
    console: console,
    setTimeout: setTimeout,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve({ json: () => ({}) })
};
vm.createContext(sandbox);

try {
    vm.runInContext(code, sandbox);
    console.log("Evaluated!");
    console.log("Is login defined?", typeof sandbox.window.login);
} catch(e) {
    console.log("Error at line:", e.stack.split('\n')[1]);
    console.log(e.message);
}
