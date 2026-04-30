const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to apply the specific patches to this clean file carefully.
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

// Instead of appending strings, I will overwrite the specific functions in the code.
// I will extract the LAST implementation of each function from the concatenated patches.

let allPatches = '';
for (const p of patches) {
    if (fs.existsSync(p)) {
        allPatches += '\n' + fs.readFileSync(p, 'utf-8');
    }
}

// Extract last sendInvoicesToClient
let match = allPatches.match(/window\.sendInvoicesToClient \= async function\(\) \{[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.sendInvoicesToClient \= async function\(\) \{[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.viewSentDetail \= async function[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.viewSentDetail \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.downloadSentLogExcel \= async function[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.downloadSentLogExcel \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.loadAdminRecentInvoices \= async function[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.loadAdminRecentInvoices \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.loadStaffInvoiceList \= async function[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.loadStaffInvoiceList \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.loadAdminStaffList \= async function[\s\S]*?\n\};\n/g);
if (match) code = code.replace(/window\.loadAdminStaffList \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);

match = allPatches.match(/window\.saveDeduction \= async function[\s\S]*?\n\};\n/g);
if (match) {
    if (code.includes('window.saveDeduction =')) {
        code = code.replace(/window\.saveDeduction \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);
    } else {
        code += '\n' + match[match.length - 1];
    }
}

match = allPatches.match(/window\.openDeductionModal \= async function[\s\S]*?\n\};\n/g);
if (match) {
    if (code.includes('window.openDeductionModal =')) {
        code = code.replace(/window\.openDeductionModal \= async function[\s\S]*?\n\};\n/g, match[match.length - 1]);
    } else {
        code += '\n' + match[match.length - 1];
    }
}

fs.writeFileSync('app_v38.js', code);
