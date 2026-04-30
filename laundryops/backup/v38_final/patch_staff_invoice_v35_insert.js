window.saveAndPrintInvoice = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    
    if(!hId || !date) { alert('거래처와 날짜를 선택해주세요.'); return; }
    
    const staffName = localStorage.getItem('staffName') || '관리자';

    let items = [];
    let total = 0;

    document.querySelectorAll('#staffInvoiceBody tr').forEach(row => {
        if(row.cells.length < 5) return;
        const qtyInput = row.querySelector('.qty-input');
        if(!qtyInput) return;
        
        const q = Number(qtyInput.value);
        if(q > 0) {
            const name = row.cells[0].innerText;
            const price = Number(qtyInput.dataset.price) || 0;
            const unit = row.cells[1].innerText;
            const category = row.dataset.category || null;
            
            items.push({ name, price, qty: q, unit, category });
            total += (price * q);
        }
    });

    if(items.length === 0) { alert('최소 1개 이상의 품목 수량을 입력해주세요.'); return; }

    try {
        document.getElementById('btnSaveInvoice').disabled = true;
        document.getElementById('btnSaveInvoice').innerText = '저장 중...';

        // items JSON 컬럼이 없으므로 제거
        const { data: invData, error: invErr } = await window.mySupabase.from('invoices').insert([{
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
                invoice_id: invData.id,
                name: it.name,
                price: it.price,
                qty: it.qty,
                unit: it.unit,
                category: it.category
            }));
            await window.mySupabase.from('invoice_items').insert(itemInserts);
        }

        alert('거래명세서가 저장되었습니다!');
        
        // 입력창 초기화
        document.querySelectorAll('.qty-input').forEach(el => el.value = 0);
        window.calcTotal();

        // 관리자 대시보드 새로고침 (옵션)
        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        
    } catch (err) {
        alert('저장 실패: ' + err.message);
    } finally {
        document.getElementById('btnSaveInvoice').disabled = false;
        document.getElementById('btnSaveInvoice').innerText = '저장하기';
    }
};
