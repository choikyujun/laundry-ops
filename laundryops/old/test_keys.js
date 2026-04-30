const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

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

try {
    vm.runInContext(code, sandbox);
    console.log(Object.keys(sandbox.window));
} catch (e) {
    console.log(e);
}
