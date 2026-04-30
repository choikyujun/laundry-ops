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
        
        const { data: existingList } = await window.mySupabase
            .from('invoices').select('id, total_amount')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hId)
            .eq('date', date)
            .limit(1);

        let invoiceId;
        if (existingList && existingList.length > 0) {
            invoiceId = existingList[0].id;
            const { error: updErr } = await window.mySupabase.from('invoices')
                .update({ total_amount: Number(existingList[0].total_amount) + totalDeductionAmount })
                .eq('id', invoiceId);
            if(updErr) throw new Error("명세서 금액 업데이트 실패: " + updErr.message);
        } else {
            invoiceId = 'inv_' + Date.now();
            const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                id: invoiceId,
                factory_id: currentFactoryId,
                hotel_id: hId,
                date: date,
                total_amount: totalDeductionAmount,
                staff_name: '관리자(차감)',
                is_sent: false
            }]);
            if(invErr) throw new Error("명세서 생성 실패: " + invErr.message);
        }

        const insertPayloads = itemsToDeduct.map(it => ({
            invoice_id: invoiceId,
            name: it.name,
            price: it.price,
            qty: it.qty
        }));

        const { error: insErr } = await window.mySupabase.from('invoice_items').insert(insertPayloads);
        if(insErr) throw new Error("품목 저장 실패: " + insErr.message);

        closeModal('deductionModal');
        
        alert('월말 차감이 성공적으로 적용되었습니다.');
        
        if (typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices(); 
        await window.sendInvoicesToClient(); 
    } catch (e) {
        console.error(e);
        alert('저장 중 오류 발생: ' + e.message);
    }
};
