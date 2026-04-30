const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// I reverted everything from scratch recently. Let's make sure the snapshot logic is back!
// Specifically, `list.forEach` should skip `관리자(차감)` staff_name so it starts blank!
code = code.replace(
    /let globalHasDeduction = false;\n\n\s*list\.forEach\(inv => \{\n\s*const items = inv\.invoice_items \|\| \[\];\n\s*items\.forEach\(it => \{/g,
    `let globalHasDeduction = false;\n\n    list.forEach(inv => {\n        // 과거 발송용으로 박제된 차감 내역은 무시 (새로운 발송은 백지에서 시작)\n        if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;\n        const items = inv.invoice_items || [];\n        items.forEach(it => {`
);

// We need to bring back `window._currentDeductions` logic to sendInvoicesToClient
// Wait, I reverted from scratch and lost `window._currentDeductions` ?
