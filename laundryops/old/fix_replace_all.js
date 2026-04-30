const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// Strip out the existing 3 functions: sendInvoicesToClient, viewSentDetail, downloadSentLogExcel
const functionsToStrip = [
    'window.sendInvoicesToClient = async function',
    'window.viewSentDetail = async function',
    'window.downloadSentLogExcel = async function',
    'window.saveDeduction = async function',
    'window.openDeductionModal = async function'
];

for (const fn of functionsToStrip) {
    const regex = new RegExp(`^${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\n\\};\\n`, 'gm');
    code = code.replace(regex, '');
}

// And `window.saveDeduction = function` (without async)
code = code.replace(/^window\.saveDeduction \= function[\s\S]*?\n\};\n/gm, '');

// Append patch_remove_memo_fix.js (contains sendInvoicesToClient, viewSentDetail, downloadSentLogExcel)
const p1 = fs.readFileSync('patch_remove_memo_fix.js', 'utf-8');

// I also need openDeductionModal and saveDeduction from patch_memory_deduction.js
// Wait, patch_memory_deduction.js had openDeductionModal and saveDeduction.
const memSrc = fs.readFileSync('patch_memory_deduction.js', 'utf-8');
const openM = memSrc.match(/window\.openDeductionModal \= async function[\s\S]*?\n\};/)[0];
const saveD = memSrc.match(/window\.saveDeduction \= function[\s\S]*?\n\};/)[0];

code += '\nwindow._currentDeductions = [];\n' + openM + '\n\n' + saveD + '\n\n' + p1;

fs.writeFileSync('app_v38.js', code);
