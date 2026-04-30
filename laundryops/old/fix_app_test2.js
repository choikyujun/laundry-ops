const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

try {
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
    console.log("Evaluated successfully. Type of window.login:", typeof sandbox.window.login);
} catch(e) {
    console.error("Evaluation failed:");
    console.error(e);
}
