const fs = require('fs');

async function debugQty() {
    const invoices = [
        { "date": "2026-04-04", "invoice_items": [{"qty": 8, "name": "M.Towel", "price": 200}, {"qty": 8, "name": "2sheet", "price": 1192}, {"qty": 8, "name": "1sheet", "price": 601}] },
        { "date": "2026-04-07", "invoice_items": [{"qty": 7, "name": "1sheet", "price": 600}, {"qty": 7, "name": "2sheet", "price": 1200}, {"qty": 7, "name": "m.towel", "price": 200}] },
        { "date": "2026-04-08", "invoice_items": [{"qty": 5, "name": "1sheet", "price": 600}, {"qty": 5, "name": "2sheet", "price": 1200}, {"qty": 5, "name": "m.towel", "price": 200}] }
    ];

    const matrix = {};
    invoices.forEach(inv => {
        if (!matrix[inv.date]) matrix[inv.date] = {};
        (inv.invoice_items || []).forEach(it => {
            const key = it.name.toLowerCase(); // simplified exactKey logic
            matrix[inv.date][key] = (matrix[inv.date][key] || 0) + Number(it.qty);
        });
    });

    console.log(matrix);
}
debugQty();
