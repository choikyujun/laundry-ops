const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const vm = require('vm');
const sandbox = {
    window: { 
        addEventListener: () => {}, location: { hash: '' },
        mySupabase: {
            from: () => ({
                select: () => ({
                    eq: function() {
                        const obj = {
                            gte: function() { return this; },
                            lte: function() { return this; },
                            eq: function() { return this; },
                            order: function() { return this; },
                            limit: function() { return Promise.resolve({ data: [], error: null }); }
                        };
                        return obj;
                    }
                })
            })
        },
        _lastInvoiceData: [{id: 1}] // mock return
    },
    document: { 
        getElementById: () => ({ value: 'all', innerHTML: '' }), 
        querySelectorAll: () => [] 
    },
    console: { log: () => {}, error: console.error },
    currentFactoryId: 'f_123',
    setTimeout: setTimeout,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve({ json: () => ({}) })
};
vm.createContext(sandbox);

try {
    vm.runInContext(code, sandbox);
    sandbox.window.loadAdminRecentInvoices(true).then(res => {
        console.log("loadAdminRecentInvoices returned:", res);
    }).catch(e => {
        console.error("loadAdminRecentInvoices ERROR:", e.stack);
    });
} catch(e) {
    console.log("Error evaluating:", e.stack);
}
