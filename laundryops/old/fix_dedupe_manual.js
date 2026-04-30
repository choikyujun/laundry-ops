const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

const funcs = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.loadAdminRecentInvoices = async function',
    'window.loadStaffInvoiceList = async function',
    'window.loadAdminStaffList = async function'
];

for (const fn of funcs) {
    const lines = code.split('\n');
    const indices = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(fn)) indices.push(i);
    }
    
    if (indices.length > 1) {
        for (let j = 0; j < indices.length - 1; j++) {
            lines[indices[j]] = lines[indices[j]].replace(fn, fn.replace('window.', 'window.OLD_') + '_' + j);
        }
        code = lines.join('\n');
    }
}
fs.writeFileSync('app_v38.js', code);
