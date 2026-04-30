const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// 1. Contract info
code = code.replace(
`    const hContractStr = hData.contract_type === 'fixed' ? '정액제' : '단가제';
    const cTypeEl = document.getElementById('h_contractType');
    if (cTypeEl) cTypeEl.innerText = hContractStr;
    const cValEl = document.getElementById('h_contractValue');
    if (cValEl) cValEl.innerText = hData.contract_type === 'fixed' ? Number(hData.fixed_amount||0).toLocaleString()+'원' : '-';`,
`    // 계약 정보 표시
    const contractEl = document.getElementById('hotelContractInfo');
    if(contractEl) {
        const contractText = hData.contract_type === 'fixed' ? \`정액제 (월 \${Number(hData.fixed_amount || 0).toLocaleString()}원)\` : '단가제';
        contractEl.innerText = contractText;
    }`
);

// 2. Dashboard cards (Amount, Count, TopItem)
code = code.replace(
`    const tEl = document.getElementById('hotelTotalAmount');
    if(tEl) tEl.innerText = total.toLocaleString() + '원';
    const cEl = document.getElementById('hotelTotalCount');
    if(cEl) cEl.innerText = count + '건';

    const rankArea = document.getElementById('hotelItemRanking');
    if(rankArea) {
        const sorted = Object.entries(itemStats).sort((a,b) => b[1] - a[1]);
        if(sorted.length === 0) rankArea.innerHTML = '<div style="color:var(--secondary); font-size:13px;">이용 내역이 없습니다.</div>';
        else {
            rankArea.innerHTML = '<table style="width:100%; border-collapse:collapse; text-align:left;"><tbody>' + 
            sorted.slice(0, 5).map((f, i) => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:8px 0; color: #475569;">\${i+1}위</td>
                    <td style="padding:8px 0; font-weight:600;">\${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary); padding:8px 0;">\${f[1]}</td>
                </tr>
            \`).join('') + '</tbody></table>';
        }
    }`,
`    const amountEl = document.getElementById('hotelMonthlyTotal');
    if (amountEl) amountEl.innerText = total.toLocaleString() + "원";
    
    const countEl = document.getElementById('hotelMonthlyCount');
    if (countEl) countEl.innerText = count + "회";
    
    const topEl = document.getElementById('hotelTopItem');
    if (topEl) {
        const top = Object.entries(itemStats).sort((a,b) => b[1]-a[1])[0];
        topEl.innerText = top ? \`\${top[0]} (\${top[1]}개)\` : "-";
    }`
);

// 3. updateHotelItemChart function call exists in HTML as:
// window.updateHotelItemChart = function(stats)
code = code.replace(
`    if(typeof window.updateHotelTrendChart === 'function') window.updateHotelTrendChart(monthlyTrend);
    if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();`,
`    if(typeof window.updateHotelItemChart === 'function') window.updateHotelItemChart(itemStats);
    if(typeof window.updateHotelTrendChart === 'function') window.updateHotelTrendChart(monthlyTrend);
    if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();`
);

fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Partner dashboard IDs fixed");
