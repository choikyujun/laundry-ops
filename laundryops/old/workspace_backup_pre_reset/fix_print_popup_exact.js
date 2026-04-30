const fs = require('fs');

const code = `
window.buildPrintAndSendReport = async function(hotelId, sDate, eDate) {
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return null; }
    
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return null; }

    const { data: allItems } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hotelId).order('created_at');

    let supplyPrice = 0;
    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            supplyPrice += (Number(it.qty) * Number(it.price));
        });
    });

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        const { data: catData } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if(!orderedCats.includes('기타')) orderedCats.push('기타');
        orderedCats.forEach(c => grouped[c] = {});

        const catMap = {};
        if (allItems) {
            allItems.forEach(ai => {
                const cat = ai.category_name || '기타';
                catMap[ai.name.toLowerCase()] = cat;
                if(!grouped[cat]) grouped[cat] = {};
                grouped[cat][ai.name] = { name: ai.name, price: Number(ai.price), qty: 0, amount: 0 };
            });
        }

        list.forEach(inv => {
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
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || Object.keys(grouped[cat]).length === 0) return;
            const itemsInCat = Object.values(grouped[cat]);
            categoriesHtml += \`
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">\${cat}</div>
                <div style="overflow-x:auto;">
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        \${itemsInCat.map(it => {
                            return \`<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:2px;">\${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">\${it.price.toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">\${it.qty}</td>
                                <td style="padding:2px; text-align:right;">₩ \${it.amount.toLocaleString()}</td>
                            </tr>\`;
                        }).join('')}
                    </tbody>
                </table>
                </div>
            </div>\`;
        });

        reportHtml = \`
            <div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래처 발송용 명세서 (\${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: \${sDate} ~ \${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px; align-items:start;">
                    \${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; text-align:right; font-weight:700;">
                    공급가: ₩ \${supplyPrice.toLocaleString()} | 부가세: ₩ \${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ \${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}
                </div>
            </div>\`;
            
    } else {
        const itemPrices = {};
        if (allItems) {
            allItems.forEach(ai => {
                itemPrices[ai.name] = Number(ai.price);
            });
        }

        const dateSequence = [];
        let curDate = new Date(sDate);
        const endD = new Date(eDate);
        while (curDate <= endD) {
            const y = curDate.getFullYear();
            const m = String(curDate.getMonth() + 1).padStart(2, '0');
            const d = String(curDate.getDate()).padStart(2, '0');
            dateSequence.push(\`\${y}-\${m}-\${d}\`);
            curDate.setDate(curDate.getDate() + 1);
        }

        const matrix = {};
        dateSequence.forEach(d => matrix[d] = {});

        list.forEach(inv => {
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
        });

        const allItemsNames = Object.keys(itemPrices).sort((a, b) => {
            const idxA = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === a.toLowerCase()) : -1;
            const idxB = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === b.toLowerCase()) : -1;
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        const qtyTotals = {};
        const priceTotals = {};
        
        allItemsNames.forEach(name => {
            let totalQty = 0;
            dateSequence.forEach(d => {
                totalQty += (matrix[d][name] || 0);
            });
            qtyTotals[name] = totalQty;
            
            let exactLineSum = 0;
            list.forEach(inv => {
                (inv.invoice_items || []).forEach(it => {
                    if ((it.name||'').toLowerCase() === name.toLowerCase()) {
                        exactLineSum += (Number(it.qty) * Number(it.price));
                    }
                });
            });
            priceTotals[name] = exactLineSum;
        });

        reportHtml = \`
            <div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (\${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: \${sDate} ~ \${eDate}</div>
                <div style="overflow-x:auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 12px; min-width: 600px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding: 4px; border: 1px solid #cbd5e1;">일자</th>
                            \${allItemsNames.map(name => \`<th style="padding: 4px; border: 1px solid #cbd5e1;">\${name}</th>\`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        \${dateSequence.map(d => \`
                            <tr>
                                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">\${parseInt(d.substring(8))}</td>
                                \${allItemsNames.map(name => \`<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">\${matrix[d][name] || 0}</td>\`).join('')}
                            </tr>
                        \`).join('')}
                        <tr style="background:#f1f5f9; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">수량 합계</td>
                            \${allItemsNames.map(name => \`<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">\${qtyTotals[name]}</td>\`).join('')}
                        </tr>
                        <tr style="background:#f9fafb; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">단가</td>
                            \${allItemsNames.map(name => \`<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:right;">₩ \${itemPrices[name].toLocaleString()}</td>\`).join('')}
                        </tr>
                        <tr style="background:#fffbeb; font-weight:700;">
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align:center;">항목 합계</td>
                            \${allItemsNames.map(name => \`<td style="padding: 4px; border: 1px solid #cbd5e1; text-align:right;">₩ \${priceTotals[name].toLocaleString()}</td>\`).join('')}
                        </tr>
                    </tbody>
                </table>
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; text-align:right; font-weight:700;">
                    공급가: ₩ \${supplyPrice.toLocaleString()} | 부가세: ₩ \${(Math.floor(supplyPrice * 0.1)).toLocaleString()} | 총 합계: ₩ \${(supplyPrice + Math.floor(supplyPrice * 0.1)).toLocaleString()}
                </div>
            </div>\`;
    }

    return { html: reportHtml, hName: h.name, list: list };
};
`;

let content = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');
const oldFuncStart = content.indexOf('window.buildPrintAndSendReport = async function');
const sendFuncStart = content.indexOf('window.exportInvoicesToPDF = async function');

if (oldFuncStart !== -1 && sendFuncStart !== -1) {
    const newContent = content.substring(0, oldFuncStart) + code + "\n" + content.substring(sendFuncStart);
    fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', newContent);
    console.log("Success");
} else {
    console.log("Could not find blocks");
}

