// Patch: v35_master 로직(Legacy)
window.loadAdminSentList_Legacy = async function() { console.log("Legacy v35_master called"); };
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    try {
        const searchTerm = document.getElementById('adminSentSearch')?.value.toLowerCase() || '';
        
        // 1. Supabase에서 발송 완료 내역 조회
        const { data: list, error } = await window.mySupabase.from('invoices')
            .select('id, date, total_amount, created_at, hotel_id, is_sent, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">DB 에러: ${error.message}</td></tr>`;
            return;
        }

        const grouped = {};
        
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '2026-04').substring(0, 7); 
                const key = 'db_' + inv.hotel_id + '_' + month;
                if(!grouped[key]) {
                    grouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음',
                        month: month,
                        totalAmount: 0,
                        lastSent: inv.created_at || inv.date,
                        count: 0,
                        source: 'db'
                    };
                }
                grouped[key].totalAmount += (inv.total_amount || 0);
                grouped[key].count += 1;
            });
        }

        // 2. 로컬 스토리지 (구버전 백업 데이터) 병합
        const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(inv => {
                const month = inv.period ? inv.period.substring(0, 7) : '2026-04';
                const key = 'local_' + inv.hotelName + '_' + month;
                if(!grouped[key]) {
                    grouped[key] = {
                        hotelId: inv.hotelId || inv.hotelName,
                        hotelName: inv.hotelName || '알수없음',
                        month: month,
                        totalAmount: 0,
                        lastSent: inv.sentAt || new Date().toISOString(),
                        count: 1,
                        source: 'local'
                    };
                }
                grouped[key].totalAmount += (inv.totalAmount || 0);
            });
        }

        const resultArr = Object.values(grouped).filter(g => 
            g.hotelName.toLowerCase().includes(searchTerm) || g.month.includes(searchTerm)
        );

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다. (새로 발송을 진행해주세요)</td></tr>';
            return;
        }

        resultArr.sort((a,b) => new Date(b.lastSent) - new Date(a.lastSent));

        window.adminSentPage = window.adminSentPage || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(resultArr.length / itemsPerPage);
        if (window.adminSentPage > totalPages && totalPages > 0) window.adminSentPage = totalPages;

        const paginated = resultArr.slice((window.adminSentPage - 1) * itemsPerPage, window.adminSentPage * itemsPerPage);

        tbody.innerHTML = '';
        paginated.forEach(inv => {
            // DB 데이터는 이미 부가세 포함이거나, 아니면 1.1 곱함.
            // 기존에 db_ 데이터에 대해서 1.1을 곱하던 로직: 그냥 total_amount 로 바로 노출해봅니다 (안전빵).
            const displayTotal = inv.totalAmount; 
            
            const sentDt = new Date(inv.lastSent);
            let dStr = isNaN(sentDt.getTime()) ? inv.lastSent : sentDt.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            tbody.innerHTML += `<tr>
                <td>${inv.month} ${inv.source==='local' ? '<small style="color:gray;">(구버전)</small>' : ''}</td>
                <td><strong>${inv.hotelName}</strong> <small>(${inv.count}건)</small></td>
                <td>${displayTotal.toLocaleString()}원</td>
                <td>${dStr}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.month}', '${inv.lastSent}')">상세조회</button>
                    ${inv.source === 'db' ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSentGroup('${inv.hotelId}', '${inv.month}')">발송취소</button>` : ''}
                </td>
            </tr>`;
        });
        
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">스크립트 에러: ${err.message}</td></tr>`;
    }
};

window.viewSentDetail = function(hotelName, month, sentAt) {
    alert(`${hotelName} 거래처의 ${month}월 정산 상세 내역은 첫 번째 탭인 '매출 및 경영 지표'에서 조회하실 수 있습니다.`);
};

// 안전장치: 문서 로드 시 바로 실행해보기 (테스트용)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (document.getElementById('tab_adminSent') && document.getElementById('tab_adminSent').classList.contains('active')) {
            window.loadAdminSentList();
        }
    }, 1000);
});

// 탭 전환 시 loadAdminSentList 호출 보장
const originalSwitchTab = window.switchTab;
// 패치 비활성화: app_v38.js 메인 로직 사용
window.switchTab = async function(el, tabId) { console.log("Disabled patch_v35_master switchTab"); };
    if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent'].includes(tabId)) {
        if (typeof window.checkAdminExpired === 'function' && await window.checkAdminExpired()) return;
    }

    // 탭 UI 변경 로직
    const parent = el.closest('.view');
    if (parent) {
        parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        
        const target = parent.querySelector('#tab_' + tabId);
        if(target) target.classList.add('active');
    }

    // 데이터 로딩 호출
    if(tabId === 'adminStats') {
        if(typeof window.loadAdminDashboard === 'function') {
            await window.loadAdminDashboard(); 
        } else if(typeof window.loadAdminRecentInvoices === 'function') {
            window.loadAdminRecentInvoices(); 
        }
    }
    if(tabId === 'adminHotel') { if(typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList(); }
    if(tabId === 'adminStaff') { 
        if(typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList(); 
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList(); 
    }
    // [중요] 발송 내역 탭 처리
    if(tabId === 'adminSent') { 
        if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList(); 
    }
    
    // 파트너 뷰
    if(tabId === 'hotelInvoice') {
        if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();
    }
    
    // [플랫폼 총괄 관리자] 탭 클릭 시 강력한 새로고침(동기화) 효과
    if(['superAdminStats', 'superAdminSettings', 'superAdminNotice'].includes(tabId)) {
        if (typeof window.loadSuperAdminDashboard === 'function') window.loadSuperAdminDashboard();
        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
        
        // 입력 폼 비우기
        const saIdInput = document.getElementById('sa_id');
        const saPwInput = document.getElementById('sa_pw');
        if(saIdInput) saIdInput.value = '';
        if(saPwInput) saPwInput.value = '';
    }
};
