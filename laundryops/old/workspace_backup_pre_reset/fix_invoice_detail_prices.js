const fs = require('fs');
let code = fs.readFileSync('patch_v35_final_v3.js', 'utf8');

// replace the pricing logic in viewInvoiceDetail
const oldLogic = `    let supplyPrice = 0;
    let mergedItems = [];
    if (allItems && allItems.length > 0) {
        allItems.forEach(ai => {
            const q = getQty(ai.name);
            supplyPrice += (Number(ai.price) * q);
            mergedItems.push({
                name: ai.name,
                price: ai.price,
                qty: q,
                category_name: ai.category_name || '기타'
            });
        });
    } else {
        items.forEach(i => {
            const q = Number(i.qty) || 0;
            supplyPrice += (Number(i.price) * q);
            mergedItems.push({
                name: i.name,
                price: i.price,
                qty: q,
                category_name: '기타'
            });
        });
    }`;

const newLogic = `    let supplyPrice = 0;
    let mergedItems = [];
    
    // 명세서에 저장된 실제 단가를 최우선으로 사용해야 함 (작성 당시 단가 보존)
    if (allItems && allItems.length > 0) {
        allItems.forEach(ai => {
            // 대소문자 구분 없이 매칭 (예: m.towel vs M.Towel)
            const invoiceItem = items.find(i => i.name.toLowerCase() === ai.name.toLowerCase());
            const q = invoiceItem ? Number(invoiceItem.qty) : 0;
            const priceToUse = invoiceItem ? Number(invoiceItem.price) : Number(ai.price);
            
            supplyPrice += (priceToUse * q);
            mergedItems.push({
                name: invoiceItem ? invoiceItem.name : ai.name,
                price: priceToUse,
                qty: q,
                category_name: ai.category_name || '기타'
            });
        });
        
        // 혹시 단가표에서 삭제되었지만 과거 명세서에는 존재하는 품목이 있다면 추가
        items.forEach(i => {
            const foundInAll = allItems.find(ai => ai.name.toLowerCase() === i.name.toLowerCase());
            if (!foundInAll) {
                const q = Number(i.qty) || 0;
                supplyPrice += (Number(i.price) * q);
                mergedItems.push({
                    name: i.name,
                    price: i.price,
                    qty: q,
                    category_name: i.category || '기타'
                });
            }
        });
    } else {
        items.forEach(i => {
            const q = Number(i.qty) || 0;
            supplyPrice += (Number(i.price) * q);
            mergedItems.push({
                name: i.name,
                price: i.price,
                qty: q,
                category_name: i.category || '기타'
            });
        });
    }`;

if(code.includes('let mergedItems = [];')) {
    code = code.replace(oldLogic, newLogic);
    fs.writeFileSync('patch_v35_final_v3.js', code);
    console.log("Fixed historical prices in viewInvoiceDetail.");
} else {
    console.log("Could not find old logic block.");
}
