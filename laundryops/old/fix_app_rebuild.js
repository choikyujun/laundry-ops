const fs = require('fs');

fs.copyFileSync('backup/v38_final/app_v38.js', 'app_v38.js');

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
        fs.appendFileSync('app_v38.js', '\n' + fs.readFileSync(p, 'utf-8'));
    }
}
