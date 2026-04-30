const fs = require('fs');
let code = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// 일반거래처 매트릭스에서 품목을 DB 단가표 순서대로 정렬
// allItems 는 이미 상단에서 const { data: allItems } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hotelId).order('created_at'); 로 가져오고 있음.

const oldLogic = `        const allItemsNames = Object.keys(itemPrices);
        const qtyTotals = {};
        const priceTotals = {};`;

const newLogic = `        // [순서 정렬 수정] DB에 등록된 순서(allItems)대로 우선 정렬, 없는 것은 뒤로
        const allItemsNames = Object.keys(itemPrices).sort((a, b) => {
            const idxA = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === a.toLowerCase()) : -1;
            const idxB = allItems ? allItems.findIndex(ai => ai.name.toLowerCase() === b.toLowerCase()) : -1;
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        
        const qtyTotals = {};
        const priceTotals = {};`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', code);
console.log("Patched array order in print popup");
