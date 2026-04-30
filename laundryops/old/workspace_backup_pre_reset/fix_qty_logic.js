const fs = require('fs');

let code = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// 1. 특수거래처: grouped[cat][exactKey].qty 와 amount 업데이트 방식 문제 수정
const oldSpecialQtyLogic = `        list.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                const lowerName = (it.name||'').toLowerCase();
                const cat = catMap[lowerName] || '기타';
                if(!grouped[cat]) grouped[cat] = {};
                
                let exactKey = Object.keys(grouped[cat]).find(k => k.toLowerCase() === lowerName);
                if (!exactKey) {
                    exactKey = it.name;
                    grouped[cat][exactKey] = { name: it.name, price: Number(it.price), qty: 0, amount: 0 };
                }
                
                grouped[cat][exactKey].qty += Number(it.qty);
                grouped[cat][exactKey].amount += (Number(it.qty) * Number(it.price));
                if (Number(it.qty) > 0) grouped[cat][exactKey].price = Number(it.price);
            });
        });`;

const newSpecialQtyLogic = `        list.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                const lowerName = (it.name||'').toLowerCase();
                const cat = catMap[lowerName] || '기타';
                if(!grouped[cat]) grouped[cat] = {};
                
                let exactKey = Object.keys(grouped[cat]).find(k => k.toLowerCase() === lowerName);
                if (!exactKey) {
                    exactKey = it.name;
                    grouped[cat][exactKey] = { name: it.name, price: Number(it.price), qty: 0, amount: 0 };
                }
                
                const q = Number(it.qty) || 0;
                grouped[cat][exactKey].qty += q;
                grouped[cat][exactKey].amount += (q * Number(it.price));
                if (q > 0) grouped[cat][exactKey].price = Number(it.price);
            });
        });`;


// 2. 일반거래처: matrix 업데이트 시 날짜가 겹치는 경우 누적해야 하는데, 덮어쓰기 등 문제가 있는지 확인
const oldMatrixLogic = `        list.forEach(inv => {
            if (!matrix[inv.date]) {
                matrix[inv.date] = {};
                if (!dateSequence.includes(inv.date)) {
                    dateSequence.push(inv.date);
                    dateSequence.sort();
                }
            }
            (inv.invoice_items || []).forEach(it => {
                let exactKey = Object.keys(itemPrices).find(k => k.toLowerCase() === (it.name||'').toLowerCase());
                if (!exactKey) {
                    exactKey = it.name;
                    itemPrices[exactKey] = Number(it.price);
                } else if (Number(it.qty) > 0) {
                    itemPrices[exactKey] = Number(it.price); 
                }
                matrix[inv.date][exactKey] = (matrix[inv.date][exactKey] || 0) + Number(it.qty);
            });
        });`;

const newMatrixLogic = `        list.forEach(inv => {
            if (!matrix[inv.date]) {
                matrix[inv.date] = {};
                if (!dateSequence.includes(inv.date)) {
                    dateSequence.push(inv.date);
                    dateSequence.sort();
                }
            }
            (inv.invoice_items || []).forEach(it => {
                let exactKey = Object.keys(itemPrices).find(k => k.toLowerCase() === (it.name||'').toLowerCase());
                const q = Number(it.qty) || 0;
                
                if (!exactKey) {
                    exactKey = it.name;
                    itemPrices[exactKey] = Number(it.price);
                } else if (q > 0) {
                    itemPrices[exactKey] = Number(it.price); 
                }
                matrix[inv.date][exactKey] = (matrix[inv.date][exactKey] || 0) + q;
            });
        });`;

code = code.replace(oldSpecialQtyLogic, newSpecialQtyLogic);
code = code.replace(oldMatrixLogic, newMatrixLogic);
fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', code);
console.log("Qty parsing bugs fixed.");
