const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

const functionsToDeduplicate = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.loadAdminRecentInvoices = async function',
    'window.loadStaffInvoiceList = async function',
    'window.loadAdminStaffList = async function',
    'window.saveDeduction = async function',
    'window.openDeductionModal = async function'
];

for (const funcName of functionsToDeduplicate) {
    let match;
    const regex = new RegExp(`^${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'gm');
    const matches = [...code.matchAll(regex)];
    
    if (matches.length > 1) {
        let newCode = '';
        let lastPos = 0;
        for (let i = 0; i < matches.length - 1; i++) {
            const match = matches[i];
            newCode += code.substring(lastPos, match.index);
            const prefix = funcName.split('.')[0];
            const name = funcName.split('.')[1].split(' = ')[0];
            const rest = funcName.split(' = ')[1];
            newCode += `${prefix}.OLD_${name}_${i} = ${rest} (`;
            lastPos = match.index + match[0].length;
        }
        newCode += code.substring(lastPos);
        code = newCode;
    }
}

fs.writeFileSync('app_v38.js', code);
