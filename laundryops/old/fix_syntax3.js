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
    const regex = new RegExp(`^${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'gm');
    const indices = [];
    while ((match = regex.exec(code)) !== null) {
        indices.push(match.index);
    }
    
    if (indices.length > 1) {
        // Find the index of the VERY LAST occurrence
        const lastIdx = indices[indices.length - 1];
        
        // Take everything BEFORE the last occurrence, and comment out the function body.
        // It's tricky because function body spans multiple lines. 
        // Safer: just rename the old functions to dummy names.
        
        let newCode = '';
        let lastPos = 0;
        
        for (let i = 0; i < indices.length - 1; i++) {
            const idx = indices[i];
            newCode += code.substring(lastPos, idx);
            newCode += `// [DEDUPE REMOVED] `;
            newCode += code.substring(idx, idx + funcName.length);
            newCode += `_OLD_${i}`;
            lastPos = idx + funcName.length;
        }
        newCode += code.substring(lastPos);
        code = newCode;
    }
}

fs.writeFileSync('app_v38.js', code);
