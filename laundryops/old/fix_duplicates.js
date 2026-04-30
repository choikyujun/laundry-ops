const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// Function names to deduplicate (keep the last occurrence)
const functionsToDeduplicate = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.loadAdminRecentInvoices = async function',
    'window.loadStaffInvoiceList = async function',
    'window.loadAdminStaffList = async function'
];

for (const funcName of functionsToDeduplicate) {
    const regex = new RegExp(`^${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'gm');
    let match;
    const indices = [];
    while ((match = regex.exec(code)) !== null) {
        indices.push(match.index);
    }
    
    if (indices.length > 1) {
        console.log(`Found ${indices.length} occurrences of ${funcName}`);
        
        // We need to keep only the LAST occurrence. So we nullify the previous ones.
        // It's safer to comment out the previous assignments.
        for (let i = 0; i < indices.length - 1; i++) {
            const idx = indices[i];
            code = code.substring(0, idx) + '// [REMOVED_BY_DEDUPE] ' + code.substring(idx);
        }
    }
}

fs.writeFileSync('app_v38.js', code);
console.log('Deduplication done.');
