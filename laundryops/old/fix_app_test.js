const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// The reason window.login is not a function might be because app_v38.js fails to load or execute fully.
// But we passed `node -c app_v38.js`.
// Let's check for any IIFE or unhandled promise rejection at top level.

// Let's test evaluating it.
try {
    const vm = require('vm');
    const sandbox = {
        window: {},
        document: {
            getElementById: () => ({}),
            querySelectorAll: () => []
        },
        console: console,
        localStorage: {
            getItem: () => null,
            setItem: () => {}
        },
        fetch: () => Promise.resolve({ json: () => ({}) })
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    console.log("Evaluated successfully. Type of window.login:", typeof sandbox.window.login);
} catch(e) {
    console.error("Evaluation failed:");
    console.error(e);
}
