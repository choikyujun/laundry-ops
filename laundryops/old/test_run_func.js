const vm = require('vm');
const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const sandbox = {
    window: { 
        addEventListener: () => {}, location: { hash: '' },
        mySupabase: {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        gte: () => ({
                            lte: () => ({
                                order: () => ({
                                    limit: () => Promise.resolve({ data: [], error: null })
                                })
                            })
                        }),
                        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) })
                    })
                })
            })
        }
    },
    document: { 
        getElementById: () => ({ value: '2026-04-01', innerHTML: '' }), 
        querySelectorAll: () => [] 
    },
    console: console,
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
