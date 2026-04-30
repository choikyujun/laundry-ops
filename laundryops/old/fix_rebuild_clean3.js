const fs = require('fs');

let code = fs.readFileSync('backup/v38_final/app_v38.js', 'utf-8');

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

const functionsToDeduplicate = [
    'window.sendInvoicesToClient',
    'window.viewSentDetail',
    'window.downloadSentLogExcel',
    'window.loadAdminRecentInvoices',
    'window.loadStaffInvoiceList',
    'window.loadAdminStaffList',
    'window.saveDeduction',
    'window.openDeductionModal'
];

// Instead of string replacement, let's just use simple last occurrence extraction by regex
for (const funcName of functionsToDeduplicate) {
    // Find all occurrences like `window.func = function` or `window.func = async function`
    // We only want the top level assignments
    const regex = new RegExp(`^${funcName.replace(/\./g, '\\.')}\\s*=\\s*(?:async\\s*)?function\\s*\\(`, 'gm');
    
    const matches = [...code.matchAll(regex)];
    if (matches.length > 1) {
        // Keep the last one, rename previous ones
        let newCode = '';
        let lastPos = 0;
        for (let i = 0; i < matches.length - 1; i++) {
            const match = matches[i];
            newCode += code.substring(lastPos, match.index);
            // Replace e.g., "window.func = async function (" with "window.OLD_func_0 = async function ("
            const prefix = funcName.split('.')[0];
            const name = funcName.split('.')[1];
            newCode += `${prefix}.OLD_${name}_${i} = ` + match[0].split('=')[1].trim();
            lastPos = match.index + match[0].length;
        }
        newCode += code.substring(lastPos);
        code = newCode;
    }
}

// 1. Backend filter
code = code.replace(/\.neq\('staff_name',\s*'관리자\(차감\)'\)/g, ".not('staff_name', 'like', '관리자(차감)%')");
// 2. Frontend logic
code = code.replace(/inv\.staff_name === '관리자\(차감\)'/g, "(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");
code = code.replace(/inv\.staff_name !== '관리자\(차감\)'/g, "!(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))");

fs.writeFileSync('app_v38_clean.js', code);
