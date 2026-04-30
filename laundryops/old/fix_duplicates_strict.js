const fs = require('fs');

let lines = fs.readFileSync('app_v38.js', 'utf-8').split('\n');

const functionsToDeduplicate = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.loadAdminRecentInvoices = async function',
    'window.loadStaffInvoiceList = async function',
    'window.loadAdminStaffList = async function'
];

for (const funcName of functionsToDeduplicate) {
    const indices = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(funcName)) {
            indices.push(i);
        }
    }
    
    if (indices.length > 1) {
        console.log(`Found ${indices.length} occurrences of ${funcName}`);
        for (let i = 0; i < indices.length - 1; i++) {
            const idx = indices[i];
            lines[idx] = '// [REMOVED] ' + lines[idx];
        }
    }
}

fs.writeFileSync('app_v38.js', lines.join('\n'));
