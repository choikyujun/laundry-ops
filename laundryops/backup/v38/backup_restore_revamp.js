// 1. 새로운 데이터 백업 함수 (DB에서 모든 연관 테이블 데이터를 직접 가져옴)
window.backupFactoryData = async function() {
    if (!confirm('시스템 전체 데이터를 백업하시겠습니까?')) return;

    try {
        alert('데이터를 백업 중입니다. 잠시만 기다려주세요.');
        
        // 팩토리 ID 기준 연관 데이터 모두 가져오기
        const tables = ['factories', 'hotels', 'invoices', 'staff', 'hotel_item_prices', 'hotel_categories'];
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

            for (const table in backupData) {
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
