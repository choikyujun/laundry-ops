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
                unit: it.unit,
                category: it.category
            }));
            await window.mySupabase.from('invoice_items').insert(itemInserts);
        }

        alert('거래명세서가 저장되었습니다!');
        
        // 입력창 초기화 및 화면 가리기
        document.getElementById('invoiceFormArea').style.display = 'none';
        
        // 거래처 선택 드롭다운 초기화
        const selectEl = document.getElementById('staffHotelSelect');
        if (selectEl) {
            selectEl.value = '';
            selectEl.focus(); // 커서를 거래처 드롭다운 메뉴로 이동
        }

        // 관리자 대시보드 및 리스트 리로드
        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        
    } catch (err) {
        alert('저장 실패: ' + err.message);
    } finally {
        document.getElementById('btnSaveInvoice').disabled = false;
        document.getElementById('btnSaveInvoice').innerText = '저장하기';
    }
};
