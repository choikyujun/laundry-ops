const fs = require('fs');

const files = [
    'app.js',
    'patch_staff_v35.js',
    'patch_backup_staff_fix_v35.js',
    'patch_sent_list_v35.js',
    'billing_logic.js',
    'patch_v35_fix2.js',
    'patch_staff_invoice_v35_fix.js',
    'patch_v35_master.js',
    'patch_sent_group_monthly.js',
    'patch_staff_list_status.js',
    'patch_view_detail_single.js',
    'patch_view_detail_single_all_items.js',
    'patch_staff_invoice_v35_insert5.js',
    'patch_staff_invoice_v35_insert6.js',
    'patch_v35_final_v3.js',
    'patch_admin_dashboard_stats_and_print.js',
    'patch_admin_invoices_list_fix.js',
    'patch_admin_dashboard_fixes.js',
    'patch_partner_dashboard_v35.js'
];

files.forEach(f => {
    try {
        const code = fs.readFileSync(f, 'utf8');
        // Syntax check
        new Function(code);
        console.log(f + " OK");
    } catch(e) {
        console.error(f + " ERROR:", e.message);
    }
});

