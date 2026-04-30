// 발송 버튼 추가 및 로컬 데이터에도 껍데기 추가 (v34 하위 호환성 위해 f.sentInvoices.push)
const fs = require('fs');
let code = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

const oldSend = `window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const report = await window.buildPrintAndSendReport(hotelFilter, sDate, eDate);
    if(!report) return;

    document.getElementById('sendInvoiceArea').innerHTML = report.html;
    
    // 발송 버튼 처리
    const btn = document.getElementById('sendInvBtn');
    if(btn) {
        btn.style.display = 'block';
        btn.onclick = async function() {
            if(confirm(\`\${report.hName} 거래처로 \${report.list.length}건의 명세서를 발송하시겠습니까?\`)) {
                const ids = report.list.map(inv => inv.id);
                await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
                alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
                window.loadAdminRecentInvoices(); 
                closeModal('sendInvoiceModal');
            }
        };
    }
    openModal('sendInvoiceModal');
};`;

const newSend = `window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const report = await window.buildPrintAndSendReport(hotelFilter, sDate, eDate);
    if(!report) return;

    // 모달 내용물 안에 발송 버튼을 직접 박아넣음
    let finalHtml = report.html + \`
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 40px; cursor: pointer; font-size: 16px; font-weight:700; background:var(--primary); color:white; border:none; border-radius:8px;">✈️ 발송하기</button>
        </div>
    \`;

    document.getElementById('sendInvoiceArea').innerHTML = finalHtml;
    
    // 발송 버튼 클릭 이벤트
    const btn = document.getElementById('sendInvBtn');
    if(btn) {
        btn.onclick = async function() {
            if(confirm(\`\${report.hName} 거래처로 \${report.list.length}건의 명세서를 발송하시겠습니까?\`)) {
                const ids = report.list.map(inv => inv.id);
                
                // 1. DB 업데이트 (invoices 테이블)
                await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
                
                // 2. [하위 호환] 로컬스토리지 데이터에도 껍데기 박아넣기 (파트너 화면에서 '수신중' 인식 위함)
                const f = platformData.factories[currentFactoryId];
                if(f) {
                    if(!f.sentInvoices) f.sentInvoices = [];
                    // supplyPrice 와 vat 추출 로직
                    // reportHtml 그릴 때 이미 더해놨지만, 지금은 간단하게 DB 리스트에서 재계산
                    let totalSup = 0;
                    report.list.forEach(inv => {
                        (inv.invoice_items || []).forEach(it => totalSup += (it.qty * it.price));
                    });
                    
                    const sentObj = {
                        sentAt: new Date().toISOString(),
                        hotelId: hotelFilter,
                        hotelName: report.hName,
                        period: sDate + ' ~ ' + eDate,
                        supplyPrice: totalSup,
                        vat: Math.floor(totalSup * 0.1),
                        totalAmount: totalSup + Math.floor(totalSup * 0.1)
                    };
                    
                    f.sentInvoices.push(sentObj);
                    localStorage.setItem('laundryPlatformV4', JSON.stringify(platformData));
                }

                alert('발송 요청이 완료되었습니다.');
                
                if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices(); 
                if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList(); 
                closeModal('sendInvoiceModal');
            }
        };
    }
    openModal('sendInvoiceModal');
};`;

code = code.replace(oldSend, newSend);
fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', code);
console.log("Send button logic injected.");
