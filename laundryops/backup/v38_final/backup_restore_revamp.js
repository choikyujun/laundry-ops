// 1. 새로운 데이터 백업 함수 (DB에서 모든 연관 테이블 데이터를 직접 가져옴)
window.backupFactoryData = async function() {
    if (await window.checkAdminExpired()) return;

    // [v38 추가] Plan 체크 (엔터프라이즈 요금제 전용)
    const { data: planData } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkAccess('DATA_BACKUP', planData, '데이터 백업은 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;

    if (!confirm('시스템 전체 데이터를 백업하시겠습니까?')) return;

    try {
        alert('데이터를 백업 중입니다. 잠시만 기다려주세요.');
        
        // 팩토리 ID 기준 연관 데이터 모두 가져오기 (의존성 순서에 맞게 배열 수정)
        const tables = ['factories', 'factory_default_prices', 'hotels', 'hotel_categories', 'hotel_item_prices', 'staff', 'invoices', 'sent_logs'];
        const backupData = {};

        for (const table of tables) {
            let query = window.mySupabase.from(table).select('*');
            if (table === 'factories') {
                query = query.eq('id', currentFactoryId);
            } else {
                query = query.eq('factory_id', currentFactoryId);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            backupData[table] = data;
        }

        // invoice_items는 factory_id가 없으므로 invoices의 id를 기반으로 가져옴
        if (backupData['invoices'] && backupData['invoices'].length > 0) {
            const invoiceIds = backupData['invoices'].map(inv => inv.id);
            const chunkSize = 100; // in() 필터 한계 방지
            backupData['invoice_items'] = [];
            for (let i = 0; i < invoiceIds.length; i += chunkSize) {
                const chunk = invoiceIds.slice(i, i + chunkSize);
                const { data: items, error: itemsErr } = await window.mySupabase.from('invoice_items').select('*').in('invoice_id', chunk);
                if (itemsErr) throw itemsErr;
                if (items) backupData['invoice_items'].push(...items);
            }
        } else {
            backupData['invoice_items'] = [];
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `laundry_backup_${currentFactoryId}_${new Date().toISOString().slice(0,10)}.json`);
        dl.click();
        
        alert('백업이 완료되었습니다.');
    } catch (err) {
        console.error(err);
        alert('백업 실패: ' + err.message);
    }
};

// 2. 새로운 데이터 복구 함수 (파일 데이터를 DB에 직접 Upsert)
window.restoreFactoryData = async function(input) {
    if (!input.files || input.files.length === 0) return;
    if (!confirm('업로드한 데이터로 시스템을 복구하시겠습니까? 데이터가 덮어씌워집니다.')) {
        input.value = '';
        return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            alert('복구를 시작합니다. 잠시만 기다려주세요.');

            // 외래키(Foreign Key) 제약조건 오류 방지를 위해 의존성 순서대로 복구
            const restoreOrder = ['factories', 'factory_default_prices', 'hotels', 'hotel_categories', 'hotel_item_prices', 'staff', 'invoices', 'invoice_items', 'sent_logs'];
            
            for (const table of restoreOrder) {
                if (backupData[table] && backupData[table].length > 0) {
                    const { error } = await window.mySupabase.from(table).upsert(backupData[table]);
                    if (error) throw error;
                }
            }
            
            alert('복구가 성공적으로 완료되었습니다! 시스템을 새로고침합니다.');
            location.reload();
        } catch (err) {
            console.error(err);
            alert('복구 실패: ' + err.message);
        }
    };
    reader.readAsText(file);
};
