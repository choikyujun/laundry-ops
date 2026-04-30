// Consolidated sendInvoicesToClient
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters) { alert('필수 항목을 모두 선택해주세요.'); return; }
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;
    
    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const report = await window.buildPrintAndSendReport(hotelFilter, sDate, eDate);
    if(!report) return;

    // 모달 내용물 안에 발송 버튼을 직접 박아넣음
    let finalHtml = report.html + `
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 40px; cursor: pointer; font-size: 16px; font-weight:700; background:var(--primary); color:white; border:none; border-radius:8px;">✈️ 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = finalHtml;
    
    // 발송 버튼 클릭 이벤트
    const btn = document.getElementById('sendInvBtn');
    if(btn) {
        btn.onclick = async function() {
            if(confirm(`${report.hName} 거래처로 월정산 명세서를 발송하시겠습니까?`)) {
                const ids = report.list.map(inv => inv.id);
                
                // 1. DB 업데이트 (invoices 테이블)
                const groupId = `g_${sDate}_${eDate}_${Date.now()}`;
                await window.mySupabase.from('invoices').update({ is_sent: true, sent_group_id: groupId }).in('id', ids);
                
                alert('발송 요청이 완료되었습니다.');
                
                if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices(); 
                if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList(); 
                closeModal('sendInvoiceModal');
            }
        };
    }
    openModal('sendInvoiceModal');
};
