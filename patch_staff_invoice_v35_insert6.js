// 기존에 saveAndPrintInvoice 함수에 있던 버그 수정 (tr 조회 중 에러/누락 방지)
window.saveAndPrintInvoice = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    
    if(!hId || !date) { alert('거래처와 날짜를 선택해주세요.'); return; }
    
    const staffName = localStorage.getItem('staffName') || '관리자';

    let items = [];
    let total = 0;

    // table 요소 가져오기 (특수/일반 모두 포괄)
    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    
    for (let row of rows) {
        // 카테고리 헤더(1칸짜리)나 불완전한 칸은 무시
        if(row.cells.length < 5) continue;
        
        const qtyInput = row.querySelector('.qty-input');
        if(!qtyInput) continue;
        
        const q = Number(qtyInput.value) || 0;
        if(q > 0) {
            // 품목명은 첫 번째 칸
            const name = row.cells[0].innerText.trim();
            // 단가는 data-price 에서 긁어옴
            const price = Number(qtyInput.dataset.price) || 0;
            // 단위는 두 번째 칸
            const unit = row.cells[1].innerText.trim();
            
            items.push({ name, price, qty: q, unit });
            total += (price * q);
        }
    }

    if(items.length === 0) { alert('최소 1개 이상의 품목 수량을 입력해주세요.'); return; }

    try {
        document.getElementById('btnSaveInvoice').disabled = true;
        document.getElementById('btnSaveInvoice').innerText = '저장 중...';

        let targetInvId = window.currentEditingInvoiceId;

        if (targetInvId) {
            // 수정 (Update)
            await window.mySupabase.from('invoices').update({
                total_amount: total,
                staff_name: staffName,
                updated_at: new Date().toISOString()
            }).eq('id', targetInvId);

            await window.mySupabase.from('invoice_items').delete().eq('invoice_id', targetInvId);

            const itemInserts = items.map(it => ({
                id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('item_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                invoice_id: targetInvId,
                name: it.name,
                price: it.price,
                qty: it.qty,
                unit: it.unit
            }));
            await window.mySupabase.from('invoice_items').insert(itemInserts);

            alert('명세서가 수정되었습니다!');
        } else {
            // 신규 (Insert)
            const newInvId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('inv_' + Date.now() + Math.random().toString(36).substr(2, 9));

            const { data: invData, error: invErr } = await window.mySupabase.from('invoices').insert([{
                id: newInvId,
                factory_id: currentFactoryId,
                hotel_id: hId,
                date: date,
                total_amount: total,
                staff_name: staffName,
                is_sent: false
            }]).select().single();

            if (invErr) throw invErr;

            if (invData && invData.id) {
                const itemInserts = items.map(it => ({
                    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ('item_' + Date.now() + Math.random().toString(36).substr(2, 9)),
                    invoice_id: invData.id,
                    name: it.name,
                    price: it.price,
                    qty: it.qty,
                    unit: it.unit
                }));
                await window.mySupabase.from('invoice_items').insert(itemInserts);
            }

            alert('거래명세서가 저장되었습니다!');
        }
        
        window.currentEditingInvoiceId = null;

        document.getElementById('invoiceFormArea').style.display = 'none';
        const selectEl = document.getElementById('staffHotelSelect');
        if (selectEl) {
            selectEl.value = '';
            selectEl.focus(); 
        }

        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        
    } catch (err) {
        alert('저장 실패: ' + err.message);
    } finally {
        document.getElementById('btnSaveInvoice').disabled = false;
        document.getElementById('btnSaveInvoice').innerText = '저장하기';
    }
};
