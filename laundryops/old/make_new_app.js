const fs = require('fs');
const oldApp = fs.readFileSync('app_v38.js', 'utf-8');

const base = oldApp.split('window.sendInvoicesToClient = async function() {')[0];

const saveBlock = fs.readFileSync('patch_memory_deduction.js', 'utf-8')
    .split('window.sendInvoicesToClient = async function() {')[0];

const sendBlock = fs.readFileSync('patch_remove_memo_fix.js', 'utf-8');
const staffBlock = fs.readFileSync('patch_staff_list_fix3.js', 'utf-8');

fs.writeFileSync('app_v38.js', base + saveBlock + sendBlock + '\n' + staffBlock);
