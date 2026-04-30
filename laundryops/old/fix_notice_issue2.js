const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const vm = require('vm');
const sandbox = {
    window: { 
        addEventListener: () => {}, location: { hash: '' },
        mySupabase: {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        maybeSingle: () => Promise.resolve({ data: { global_notice: "TEST NOTICE!" } })
                    })
                })
            })
        }
    },
    document: { 
        getElementById: (id) => {
            if (id === 'globalNoticeBar') return { style: {} };
            if (id === 'globalNoticeInput') return {};
            return null;
        }, 
        querySelectorAll: () => [] 
    },
    console: console,
    currentFactoryId: 'f_123',
    setTimeout: setTimeout,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve({ json: () => ({}) })
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

sandbox.window.loadGlobalNotice().then(() => {
    console.log("Called loadGlobalNotice");
});
