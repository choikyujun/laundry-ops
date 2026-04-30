
window.generateInvoiceMatrixHtml = function(h, list, sDate, eDate, supplyPrice, vat, totalAmount, isSendDialog, fullList, isSpecial) {
    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};
    const itemOrderMap = {};
    (h.items || []).forEach((item, idx) => itemOrderMap[item.name] = item.sort_order ?? idx);

    list.forEach(inv => {
        const items = inv.invoice_items || inv.items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + Number(it.qty || 0);
            itemInfoMap[it.name] = { price: Number(it.price || 0), category: it.category || '기타' };
        });
    });

    const sortedItemNames = Object.keys(itemInfoMap).sort((a,b) => (itemOrderMap[a] ?? 999) - (itemOrderMap[b] ?? 999));

    const styleContent = `
        <style>
            .report-container { font-family: 'Malgun Gothic', sans-serif; font-size: 8px; padding: 2px; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 2px; border: 1px solid #cbd5e1; }
            .report-table th { background: #f1f5f9; color: #000; font-weight: 700; padding: 1px 2px; border: 1px solid #cbd5e1; text-align: center; font-size: 8px; }
            .report-table td { padding: 1px 2px; border: 1px solid #cbd5e1; text-align: center; font-size: 8px; }
            .blue-col { background: #f1f5f9 !important; color: #000 !important; font-weight: 700; }
            .total-row { font-weight: 700; background: #f8fafc; }
        </style>
    `;

    const sendButton = isSendDialog ? `<div style="text-align:center; margin-top:10px;">
        <button id="sendInvBtn" style="padding: 10px 30px; font-size: 14px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:6px;">
            🚀 거래처로 발송하기 (${fullList.length}건)
        </button>
    </div>` : '';

    let htmlContent = '';
    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = {};
            let totalQty = 0;
            dateSequence.forEach(d => { if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name]; });
            grouped[cat][name] = { qty: totalQty, price: itemInfoMap[name].price };
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:5px; border:1px solid #cbd5e1; display:inline-block; width:49%; vertical-align:top; margin-right: 0.5%;">
                <div class="blue-col" style="padding:2px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1; font-size:8px;">${cat}</div>
                <table class="report-table" style="margin-top:0;">
                    <thead><tr><th>품목</th><th>단가</th><th>수량</th><th>금액</th></tr></thead>
                    <tbody>
                        ${Object.keys(grouped[cat]).map(name => `<tr>
                            <td>${name}</td>
                            <td>${grouped[cat][name].price.toLocaleString()}</td>
                            <td>${grouped[cat][name].qty.toLocaleString()}</td>
                            <td>₩ ${(grouped[cat][name].price * grouped[cat][name].qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });
        htmlContent = `<div class="report-container" style="display:flex; flex-wrap:wrap;">${categoriesHtml}</div>`;
    } else {
        htmlContent = `<div class="report-container">
            <table class="report-table">
                <thead>
                    <tr>
                        <th class="blue-col">일자</th>
                        ${sortedItemNames.map(name => `<th class="blue-col">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td class="blue-col">${parseInt(d.substring(8))}</td>
                            ${sortedItemNames.map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row"><td class="blue-col">합계</td>${sortedItemNames.map(name => { const t = dateSequence.reduce((s,d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0); return `<td>${t}</td>`; }).join('')}</tr>
                </tfoot>
            </table>
        </div>`;
    }

    const wrapper = `
        <div class="report-container">
            <h1 style="text-align:center; margin:5px 0; font-size: 14px;">세탁 거래명세서 (${h.name})</h1>
            ${htmlContent}
            <div style="margin-top:5px; padding:5px; border:1px solid #005b9f; border-radius:4px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; font-size:10px;">
                <div style="font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 12px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            ${sendButton}
        </div>
    `;

    return isSendDialog ? styleContent + wrapper : `<html><head>${styleContent}</head><body>${wrapper}</body></html>`;
};

// Final switchTab override
window.switchTab = async function(el, tabId) {
    
    // 요금제 만료 상태에서 관리자 탭 접근 시 차단 및 결제 유도
    if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent'].includes(tabId)) {
        if (typeof window.checkAdminExpired === 'function' && await window.checkAdminExpired()) return;
    }

    // 탭 전환 UI
    const parent = el.closest('.view');
    if (parent) {
        parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        const target = parent.querySelector('#tab_' + tabId);
        if(target) target.classList.add('active');
    }
  
    // 탭 전환 시 데이터 로드 함수 명시적 호출
    if(tabId === 'adminStats') if(typeof window.loadAdminDashboard === 'function') await window.loadAdminDashboard();
    if(tabId === 'adminHotel') if(typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList();
    if(tabId === 'adminStaff') if(typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList();
    if(tabId === 'adminSent') {
        if(typeof window.loadAdminSentList === 'function') {
            window.loadAdminSentList();
        }
    }
    if(tabId === 'adminPayment') if(typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
};
