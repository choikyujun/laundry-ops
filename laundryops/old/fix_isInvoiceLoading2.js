const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const vm = require('vm');
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
    console.log("Evaluation OK");
    console.log("_isInvoiceLoading exists?", typeof sandbox._isInvoiceLoading);
    console.log("window.loadAdminRecentInvoices exists?", typeof sandbox.window.loadAdminRecentInvoices);
} catch(e) {
    console.log("Error evaluating:", e.message, "at line", e.stack.split('\n')[1]);
}
