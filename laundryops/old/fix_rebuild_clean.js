const fs = require('fs');

let code = fs.readFileSync('backup/v38_final/app_v38.js', 'utf-8');

// The patches I want to apply:
const patches = [
    'patch_option1.js',
    'patch_option1_v2.js',
    'patch_option1_v3.js',
    'patch_option1_v4.js',
    'patch_option1_v5.js',
    'patch_option1_v6.js',
    'patch_option1_v7.js',
    'patch_option2.js',
    'patch_option2_fix.js',
    'patch_option2_enter_fix.js',
    'patch_option2_fk_fix.js',
    'patch_option2_display_fix.js',
    'patch_option2_send_fix.js',
    'patch_admin_list_fix.js',
    'patch_admin_staff_list_fix.js',
    'patch_memory_deduction.js',
    'patch_sent_logs_fix.js',
    'patch_view_detail_clean.js',
    'patch_view_detail_final_memo.js',
    'patch_excel_fix.js',
    'patch_final_distinguish.js',
    'patch_special_swap.js',
    'patch_special_text.js',
    'patch_staff_list.js',
    'patch_option2_nomerge.js',
    'patch_staff_list_fix2.js',
    'patch_staff_list_fix3.js'
];

for (const p of patches) {
    if (fs.existsSync(p)) {
        code += '\n' + fs.readFileSync(p, 'utf-8');
    }
}

// deduplicate
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
    const indices = [];
    while ((match = regex.exec(code)) !== null) {
        indices.push(match.index);
    }
    
    if (indices.length > 1) {
        let newCode = '';
        let lastPos = 0;
        
        for (let i = 0; i < indices.length - 1; i++) {
            const idx = indices[i];
            newCode += code.substring(lastPos, idx);
            // replace with dummy name so it won't execute and won't conflict
            newCode += funcName.replace('window.', 'window.OLD_') + '_' + i + ' = async function (';
            lastPos = idx + funcName.length + 1;
        }
        newCode += code.substring(lastPos);
        code = newCode;
    }
}

fs.writeFileSync('app_v38_clean.js', code);
