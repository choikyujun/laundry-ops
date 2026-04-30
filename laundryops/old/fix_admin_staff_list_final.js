const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I removed `.neq('staff_name', '관리자(차감)')` globally because of error, but didn't replace it properly in loadAdminStaffList.
// In loadAdminStaffList, I should filter in the frontend to avoid `.not` logic completely.

const oldBlock = `// [수정] 관리자(차감) 명세서는 직원 발행 현황에서도 보이지 않도록 필터링
    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        
        .order('created_at', { ascending: false })
        .range(startIdx, endIdx);

    if(iErr) { activityBody.innerHTML = \`<tr><td colspan="4" style="color:red;">에러: \${iErr.message}</td></tr>\`; }
    else if(!invoices || invoices.length === 0) { activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>'; }
    else {
        activityBody.innerHTML = '';
        invoices.forEach(inv => {`;

const newBlock = `// [수정] 관리자(차감) 명세서는 직원 발행 현황에서도 보이지 않도록 필터링
    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        .order('created_at', { ascending: false })
        .limit(itemsPerPage * 3); // 차감이 포함될 수 있으므로 약간 넉넉하게 불러온 후 프론트에서 필터링하여 페이징

    if(iErr) { activityBody.innerHTML = \`<tr><td colspan="4" style="color:red;">에러: \${iErr.message}</td></tr>\`; }
    else {
        const filteredInvoices = invoices ? invoices.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        const pageInvoices = filteredInvoices.slice(startIdx, endIdx + 1);
        
        if (pageInvoices.length === 0) {
            activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>';
        } else {
            activityBody.innerHTML = '';
            pageInvoices.forEach(inv => {`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('app_v38.js', code);
