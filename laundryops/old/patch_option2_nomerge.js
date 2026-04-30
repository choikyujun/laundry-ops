window.saveDeduction = async function() {
    try {
        const hId = document.getElementById('deductHotelId').value;
        const date = document.getElementById('adminStatsEndDate').value || new Date().toISOString().split('T')[0];
        
        if (!hId) return;

        const itemsToDeduct = [];
        document.querySelectorAll('.deduct-qty-input').forEach(input => {
            const qty = Number(input.value); 
            if (qty < 0) {
                const name = input.getAttribute('data-name');
                const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
                itemsToDeduct.push({ name: name + ' (차감)', price, qty });
            }
        });

        if (itemsToDeduct.length === 0) {
            alert('차감할 수량을 입력해주세요.');
            return;
        }

        const totalDeductionAmount = itemsToDeduct.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // [핵심 변경] 기존 명세서(현장 직원이 작성한 것)와 절대 병합하지 않음!
        // 무조건 새로운 독립적인 '차감 전용 명세서'를 생성하여 원본 데이터를 훼손하지 않습니다.
        const invoiceId = 'inv_' + Date.now() + '_deduct';
        
        const { error: invErr } = await window.mySupabase.from('invoices').insert([{
            id: invoiceId,
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalDeductionAmount,
            staff_name: '관리자(차감)',
            author: '관리자(차감)',
            is_sent: false
        }]);
        
        if(invErr) throw new Error("차감 명세서 생성 실패: " + invErr.message);

        const insertPayloads = itemsToDeduct.map(it => ({
            invoice_id: invoiceId,
            name: it.name,
            price: it.price,
            qty: it.qty
        }));

        const { error: insErr } = await window.mySupabase.from('invoice_items').insert(insertPayloads);
        if(insErr) throw new Error("차감 품목 저장 실패: " + insErr.message);

        closeModal('deductionModal');
        alert('월말 차감이 성공적으로 등록되었습니다.');
        
        if (typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices(); 
        
        // 발송 팝업 새로고침
        if (typeof window.sendInvoicesToClient === 'function') await window.sendInvoicesToClient(); 
        
    } catch (e) {
        console.error(e);
        alert('저장 중 오류 발생: ' + e.message);
    }
};
