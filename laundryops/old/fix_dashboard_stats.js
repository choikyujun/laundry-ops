const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// In calculateAdminDashStats: we need to filter out '관리자(차감)'
const regexStats = /const { data: invData } = await window\.mySupabase\.from\('invoices'\)\s*\n\s*\.select\('date, total_amount, hotel_id, hotels\(name, contract_type\)'\)\s*\n\s*\.eq\('factory_id', currentFactoryId\);/;

code = code.replace(regexStats, `const { data: invData } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, staff_name, hotels(name, contract_type)')
        .eq('factory_id', currentFactoryId);`);

code = code.replace(/if\(invData\) {\n\s*invData\.forEach\(inv => {/g, `if(invData) {
        invData.forEach(inv => {
            // [수정] 대시보드 통계 계산 시 차감 명세서는 완전히 제외하여 매출 합계를 왜곡하지 않게 함
            if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;`);

fs.writeFileSync('app_v38.js', code);
