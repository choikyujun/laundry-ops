// 1. 관리자 화면 삭제 기능 DB와 연동
window.deleteInvoice = async function(invId) {
    if(!confirm('정말 이 명세서를 삭제하시겠습니까? (삭제된 데이터는 복구할 수 없습니다)')) return;
    
    try {
        // DB에서 삭제
        const { error } = await window.mySupabase.from('invoices').delete().eq('id', invId);
        if (error) throw error;

        // 화면 갱신
        if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices();
        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        
        alert('삭제되었습니다.');
    } catch(err) {
        alert('삭제 중 오류가 발생했습니다: ' + err.message);
    }
};

// 2. 대표자 대시보드 리스트 출력 시 [보기] 버튼도 방금 고친 단일 viewInvoiceDetail 을 재사용하도록
// 이미 patch_view_detail_single_all_items.js (patch_v35_final_v3.js) 의 함수가 덮어써져 있으므로
// 대표자 화면의 10개씩 불러오는 loadAdminRecentInvoices 에서 그 함수를 호출하고 있는지 확인만 합니다.
// (실제로 버튼 onClick='viewInvoiceDetail' 이 연결되어 있으므로 자동 적용됨)
