const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

const functionsToDeduplicate = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.loadAdminRecentInvoices = async function',
    'window.loadStaffInvoiceList = async function',
    'window.loadAdminStaffList = async function'
];

for (const funcName of functionsToDeduplicate) {
    let match;
    const regex = new RegExp(`\\/\\/ \\[DEDUPE REMOVED\\] ${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_OLD_\\d+`, 'gm');
    code = code.replace(regex, (match) => {
        // Instead of just renaming the function, we keep the async keyword!
        return match.replace('_OLD_', '_OLD_') + ' /* DUMMY ASYNC */ ';
    });
}

// Wait, the regex above was renaming `window.viewSentDetail = async function` to `... = async function_OLD_0`. 
// The problem is `async function_OLD_0` is a syntax error! It should be `async function _OLD_0` OR `async function(...)`. 
// Let's fix that.

code = code.replace(/async function_OLD_(\d+)/g, 'async function /*OLD*/');

fs.writeFileSync('app_v38.js', code);
