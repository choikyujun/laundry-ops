console.log("APP_V38 LOADED - 2026-04-13");
console.log("app.js loaded");

// Supabase 초기화 및 데이터 로드
const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
if (window.supabase) {
    window.mySupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
}

async function fetchFromSupabase() {
    console.log("DEBUG: fetchFromSupabase (SQL-First 모드, 데이터 로드 안 함)");
    // SQL-First 모드에서는 각 함수들이 직접 Supabase를 조회하므로 여기서는 빈 함수로 유지합니다.
}

function setupRealtimeSubscription() {
    if (!window.mySupabase) return;
    console.log("Realtime subscription setup started");
    // [v37 Cleanup] platform_data 리스너 제거됨
}

console.log("=== v37 파일이 정상 로드되었습니다! ===");
window.initApp = async function() {
    // [Fast-Track] 관리자가 공장 관리에서 클릭하여 들어온 경우만 자동 로그인
    const adminAccessId = localStorage.getItem('adminAccessFactoryId');
    if (adminAccessId) {
        currentFactoryId = adminAccessId;
        const { data: f } = await window.mySupabase.from('factories').select('name').eq('id', currentFactoryId).maybeSingle();
        if (f) {
            localStorage.removeItem('adminAccessFactoryId'); // 1회용 소진
            showView('adminView', f.name + ' - 대표');
            setupRealtimeSubscription(); // [수정] 바로가기 시에도 실시간 구독 연결
            await window.loadAdminDashboard();
            return;
        }
    }

    await fetchFromSupabase();
    console.log("Supabase 데이터 로드 시도 완료");
    setupRealtimeSubscription();
}
window.addEventListener('DOMContentLoaded', initApp);

window.logout = function() {
    localStorage.removeItem('currentFactoryId');
    localStorage.removeItem('adminAccessFactoryId');
    location.reload();
};

// platformData 전역 변수 초기화 (더 이상 데이터 저장용으로 쓰지 않음)
let platformData = { factories: {}, pendingFactories: {} };



let currentFactoryId = null, currentHotelId = null, editingHotelId = null, editingFactoryId = null, currentStaffName = null;
let currentPage = 1, currentStaffPage = 1, adminSentPage = 1;
const itemsPerPage = 50;
let revenueTrendChart = null, hotelItemChart = null, hotelTrendChart = null;

window.toggleDropdown = function() {
    console.log("toggleDropdown triggered");
    const menu = document.getElementById('dropdownMenu');
    if (!menu) {
        console.error("dropdownMenu element not found");
        return;
    }
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

window.getSubscriptionStyles = function(status) {
    const styles = {
        'active': { bg: '#dcfce7', color: '#166534' },
        'trial': { bg: '#e0f2fe', color: '#075985' },
        'expiring': { bg: '#fef3c7', color: '#92400e' },
        'expired': { bg: '#fee2e2', color: '#991b1b' }
    };
    return styles[status] || { bg: '#f1f5f9', color: '#64748b' };
};

window.getSubscriptionStatus = function(factory) {
    const today = new Date();
    
    // 1. 저장된 구독 상태가 있으면 우선 반환 (snake_case DB 필드 우선)
    const subStatusValue = factory.sub_status || factory.subStatus;
    if (subStatusValue) {
        const statusLabels = { 'active': '활성(운영중)', 'operating': '활성(운영중)', 'expiring': '만료 임박', 'expired': '만료됨', 'trial': '무료체험' };
        return { status: subStatusValue, label: statusLabels[subStatusValue] || subStatusValue };
    }

    if (!factory.createdAt) return { status: 'active', label: '사용중' };
    const createdDate = new Date(factory.createdAt);
    const diffDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

    if (factory.planExpiry) {
        const expiryDate = new Date(factory.planExpiry);
        if (expiryDate < today) return { status: 'expired', label: '요금제 만료됨' };
        if (expiryDate - today < 7 * 24 * 60 * 60 * 1000) return { status: 'expiring', label: '요금제 만료 임박' };
    }

    if (diffDays <= 30 && (!factory.plan || factory.plan === '라이트')) {
        return { status: 'trial', label: `무료 체험 중 (${30 - diffDays}일 남음)` };
    }

    return { status: 'active', label: (factory.plan || '라이트') + ' 요금제 사용 중' };
};

window.selectCustomRole = function(role, text) {
    document.getElementById('loginRole').value = role;
    const roleText = document.getElementById('selectedRoleText');
    roleText.innerText = text;
    roleText.style.color = 'var(--primary)'; // 선택 후 글자색 진하게
    document.getElementById('dropdownMenu').style.display = 'none';

    // Admin인 경우에만 회원가입 버튼 표시
    const registerBtn = document.querySelector('button[onclick="openRegisterModal()"]');
    if(registerBtn) registerBtn.style.display = (role === 'admin') ? 'block' : 'none';
};

// 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('customDropdown');
    const menu = document.getElementById('dropdownMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// URL 해시 체크하여 superadmin 옵션 추가
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// [SQL-First] 이제 모든 데이터 처리는 직접 DB(Supabase)를 사용하므로 saveData는 사용하지 않습니다.
// 모든 saveData() 호출은 주석 처리 또는 제거되었습니다.
window.saveData = async function() {
    console.log("SQL-First 모드에서는 saveData()를 사용하지 않습니다.");
};
function openModal(id) { 
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex'; 
    } else {
        console.error("DEBUG: Modal element not found for ID:", id);
        alert('모달창을 찾을 수 없습니다.');
    }
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.openManualModal = function() { openModal('manualModal'); }

window.openBackupHelpModal = function() { openModal('backupHelpModal'); }

window.backupFactoryData = async function() {
    if (await window.checkAdminExpired()) return;
    
    // 1. Plan 체크 먼저 수행 (빠르게 팝업 띄우기)
    const { data: planData } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkAccess('DATA_BACKUP', planData, '데이터 백업은 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    if (!confirm('현재 데이터를 백업 파일로 저장하시겠습니까?')) return;

    // 2. Plan 통과 시에만 무거운 DB 전체 데이터 가져오기
    const { data: f } = await window.mySupabase.from('factories').select('*, hotels(*), invoices(*), staff(*), factory_default_prices(*)').eq('id', currentFactoryId).single();
    if (!f) { alert('데이터를 불러오는 중 오류가 발생했습니다.'); return; }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(f));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `backup_${f.name}_${getTodayString()}.json`);
    dl.click();
};

window.openRestoreDialog = async function() {
    if (await window.checkAdminExpired()) return;

    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkAccess('DATA_BACKUP', f, '데이터 복구는 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    document.getElementById('restoreFile').click();
};

window.restoreFactoryData = function(input) {
    // 복구 실행 전 최종 확인
    if (!confirm('업로드한 데이터로 시스템을 복구하고 새로고침하시겠습니까?')) {
        input.value = ''; // 초기화
        return;
    }

    const file = input.files[0];
    if (!file) return;
    
    // 복구 시작 알림
    alert('데이터 복구 중입니다. 잠시만 기다려주세요.');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const restoredData = JSON.parse(e.target.result);
            if (!restoredData.name || !restoredData.adminId) throw new Error("유효하지 않은 데이터 파일입니다.");
            platformData.factories[currentFactoryId] = restoredData;
            saveData();
            alert('복구가 완료되었습니다.');
            
            // [수정] 강제 새로고침 시도
            if (typeof loadAdminDashboard === 'function') loadAdminDashboard();
            if (typeof loadAdminHotelList === 'function') loadAdminHotelList();
            if (typeof loadAdminStaffList === 'function') loadAdminStaffList();
            if (typeof loadAdminSentList === 'function') loadAdminSentList();
        } catch (err) { 
            alert('복구 실패: ' + err.message); 
        }
    };
    reader.readAsText(file);
};
function getTodayString() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

async function syncToSupabase(data) {
    if (!window.mySupabase) return;
    try {
// [v37 Cleanup] platform_data 저장 함수 제거됨
        console.log("Supabase 동기화 성공");
    } catch (e) {
        console.error("Supabase 동기화 실패:", e);
    }
}

window.openPlanInfoModal = function() {
    openModal('planInfoModal');
};

function showView(id, title) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  const header = document.getElementById('headerTitle');
  if(header) header.innerText = title;

  const logoutBtn = document.getElementById('logoutBtn');
  const helpBtn = document.getElementById('helpBtn');
  const planInfoBtn = document.getElementById('planInfoBtn');
  if(logoutBtn) logoutBtn.style.display = (id === 'loginView') ? 'none' : 'block';
  if(helpBtn) helpBtn.style.display = (id === 'adminView') ? 'block' : 'none';
  if(planInfoBtn) planInfoBtn.style.display = (id === 'adminView') ? 'block' : 'none';

  if(id === 'superAdminView') loadSuperAdminDashboard();
  if(id === 'adminView') loadAdminDashboard();
  if(id === 'staffView') loadStaffDashboard();
}

window.checkAdminExpired = async function() {
    const { data: f, error } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle();
    if (error || !f) return false;

    // 만료 여부는 요금제(plan)가 아니라, 구독 상태(sub_status)가 expired인지 직접 확인
    const subStatus = window.getSubscriptionStatus(f);
    if (subStatus.status === 'expired' || f.sub_status === 'expired') {
        const paymentMsg = document.getElementById('paymentMsg');
        if (paymentMsg) paymentMsg.innerText = "구독 상태가 만료되었습니다. 결제 후 이용 가능합니다.";
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return true;
    }
    return false;
};

window.switchTab = async function(el, tabId) {
  // 요금제 만료 상태에서 관리자 탭 접근 시 차단 및 결제 유도
  if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent'].includes(tabId)) {
      if (await window.checkAdminExpired()) return;
  }

  // [보완] 관리자 탭 한정으로만 레거시 동기화 실행 (슈퍼어드민은 별도 처리)
  if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent', 'adminPayment'].includes(tabId)) {
      await window.fetchFromSupabase();
  }
  
  // 데이터 동기화 후 다시 렌더링하도록 탭 전환 로직 개선
  const parent = el.closest('.view');
  parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const target = parent.querySelector('#tab_' + tabId);
  if(target) target.classList.add('active');
  
  // 탭 전환 시 데이터 로드 함수 명시적 호출
  if(tabId === 'adminStats') await window.loadAdminDashboard();
  if(tabId === 'adminHotel') window.loadAdminHotelList();
  if(tabId === 'adminStaff') window.loadAdminStaffList();
  if(tabId === 'adminSent') window.loadAdminSentList();
  if(tabId === 'adminPayment') window.loadAdminPayment();
  
  // 총괄 관리자 - 현황 탭 클릭 시 데이터 새로고침
  if (tabId === 'superAdminStats') {
      if (typeof window.loadSuperAdminDashboard === 'function') window.loadSuperAdminDashboard();
  }
};

window.goToPaymentTab = function() {
    closeModal('paymentModal');
    
    // [변경] 결제 폼 모달을 직접 열기
    openModal('paymentDirectModal');
    window.loadAdminPayment();
};

window.loadAdminPayment = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f) return;
    
    // factory ID를 사용해 최신 데이터 다시 로드
    // Supabase에서 현재 공장 정보 다시 가져오기
    window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle().then(({data}) => {
        if(data) {
            const subStatus = window.getSubscriptionStatus(data);
            const planName = data.plan || '라이트';
            const htmlContent = `
                <div style="font-size: 24px; font-weight: 900; color: var(--primary); margin-bottom: 5px;">${planName} 요금제</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--secondary);">구독상태: ${subStatus.label} | 만료일: ${data.plan_expiry || '제한없음'}</div>
            `;
            
            const subStatusBox = document.getElementById('subStatusBox');
            const modalSubStatusBox = document.getElementById('modalSubStatusBox');
            
            if (subStatusBox) subStatusBox.innerHTML = htmlContent;
            if (modalSubStatusBox) modalSubStatusBox.innerHTML = htmlContent;
        }
    });
};

// [v37 버그픽스] invoices 테이블 조회 시 invoice_items 조인 제거하여 400 에러 해결
window.isAdminInvoicesLoading = false;
window.loadAdminSentList = async function() {
    console.log("DEBUG: loadAdminSentList 시작");
    if (window.isAdminInvoicesLoading) return;
    window.isAdminInvoicesLoading = true;
    
    const tbody = document.getElementById('adminSentList');
    if(!tbody) { console.log("DEBUG: adminSentList 엘리먼트 없음"); window.isAdminInvoicesLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">목록 불러오는 중...</td></tr>';

    console.log("DEBUG: currentFactoryId:", currentFactoryId);
    
    // SQL-First: sent_logs 테이블에서 조회
    const { data: logs, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, hotel_id')
        .eq('factory_id', String(currentFactoryId))
        .order('sent_at', { ascending: false });

    console.log("DEBUG: sent_logs response:", { logs, error });

    if(error) { 
        console.error("DEBUG: AdminSentList Supabase Error:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;">에러: ${error.message}</td></tr>`; 
        window.isAdminInvoicesLoading = false;
        return; 
    }

    // 호텔 이름 매핑용 조회 (별도 실행)
    const { data: hotels } = await window.mySupabase.from('hotels').select('id, name');
    const hotelMap = {};
    if(hotels) hotels.forEach(h => hotelMap[h.id] = h.name);

    const searchEl = document.getElementById('adminSentSearch');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';

    let newHtml = '';
    const filteredLogs = logs ? logs.filter(log => {
        const hName = (hotelMap[log.hotel_id] || '거래처없음').toLowerCase();
        return hName.includes(searchTerm) || log.period.toLowerCase().includes(searchTerm);
    }) : [];

    if(filteredLogs.length > 0) {
        filteredLogs.forEach(log => {
            const hName = hotelMap[log.hotel_id] || '거래처없음';
            const sentDate = log.sent_at ? log.sent_at.substring(0, 10) : '-';
            // 데이터 검증: total_amount가 없으면 0으로 처리
            const rawAmount = Number(log.total_amount) || 0;
            const totalWithTax = Math.round(rawAmount * 1.1);
            
            newHtml += `<tr>
                <td>${log.period}</td>
                <td>${hName}</td>
                <td>${totalWithTax.toLocaleString()}원</td>
                <td>${sentDate}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:#16a34a; color:white; border:1px solid #16a34a; border-radius:4px; margin-right:5px; height:auto; display:inline-block;" onclick="downloadSentLogExcel('${log.id}', '${log.period}')">Excel</button>
                    <button class="btn btn-neutral" style="background:var(--primary); color:white; padding:4px 8px; font-size:11px; border:1px solid var(--primary); border-radius:4px; height:auto; display:inline-block;" onclick="viewSentDetail('${hName}', '${log.period}', '${log.id}', false, '${log.hotel_id}')">내역확인</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px; margin-left:5px; border-radius:4px; height:auto; display:inline-block;" onclick="deleteSentLog('${log.id}')">발송취소</button>
                </td>
            </tr>`;
        });
    } else {
        newHtml = '<tr><td colspan="6" style="text-align:center;">발송 내역이 없습니다.</td></tr>';
    }
    tbody.innerHTML = newHtml;
    window.isAdminInvoicesLoading = false;
};

window.deleteSentLog = async function(logId) {
    if(!confirm('정말 발송 기록을 취소(삭제)하시겠습니까?')) return;
    
    const { error } = await window.mySupabase.from('sent_logs').delete().eq('id', logId);
    if(error) {
        alert('삭제 실패: ' + error.message);
        return;
    }
    
    alert('발송 기록이 삭제되었습니다.');
    window.loadAdminSentList();
};

window.changeAdminSentPage = function(delta) {
    adminSentPage += delta;
    loadAdminSentList();
};

window.OLD_viewSentDetail_0 = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    // DB 조회 방식 (SQL-First)
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // DB 조회: 해당 기간 invoices + invoice_items
    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    // 금액 계산
    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    // 품목 집계 (invoice_items 기반)
    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; // name → { price, category }
    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            if (!itemInfoMap[it.name]) itemInfoMap[it.name] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 카테고리별 2단 구성 - hotel_item_prices에서 category_name 가져오기
        const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
            .select('name, category_name')
            .eq('hotel_id', hotelId)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        // 품목별 카테고리 매핑
        const itemCatMap = {};
        const orderedCats = [];
        if (priceData) {
            priceData.forEach(p => {
                itemCatMap[p.name] = p.category_name || '기타';
                if (!orderedCats.includes(p.category_name || '기타')) orderedCats.push(p.category_name || '기타');
            });
        }
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        // 카테고리별 품목 집계
        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemCatMap[name] || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = list.reduce((s, inv) =>
                s + (inv.invoice_items || []).filter(it => it.name === name).reduce((q, it) => q + Number(it.qty||0), 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name]?.price || 0 });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                            <td style="border:1px solid #cbd5e1; padding:3px; text-align:center;">${Number(it.price).toLocaleString()}</td>
                            <td style="border:1px solid #cbd5e1; padding:3px; text-align:center;">${it.qty}</td>
                            <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h2 style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:8px; font-size:18px;">
                세탁 거래명세서 (${h.name})
            </h2>
            <div style="text-align:right; margin-bottom:8px; font-size:12px; color:#64748b;">조회 기간: ${period}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">${categoriesHtml}</div>
            <div style="margin-top:14px; padding:14px 18px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </div>`;

    } else {
        // [일반거래처] 매트릭스 (날짜 × 품목)
        const allDates = [];
        for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        // 품목 순서: hotel_item_prices 기준
        const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
            .select('name').eq('hotel_id', hotelId)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });
        const orderedNames = priceOrder ? priceOrder.map(p => p.name).filter(n => itemInfoMap[n]) : [];
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        const allItems = [...orderedNames, ...extraNames];

        const matrix = {};
        allDates.forEach(d => { matrix[d] = {}; allItems.forEach(n => matrix[d][n] = 0); });
        list.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                if (matrix[inv.date]) matrix[inv.date][it.name] = (matrix[inv.date][it.name]||0) + Number(it.qty||0);
            });
        });

        const qtyTotals = {}, priceTotals = {};
        allItems.forEach(name => {
            qtyTotals[name] = allDates.reduce((s, d) => s + (matrix[d][name]||0), 0);
            priceTotals[name] = qtyTotals[name] * (itemInfoMap[name]?.price||0);
        });

        const thS = 'style="padding:3px 5px; border:1px solid #cbd5e1; font-size:11px; text-align:center; white-space:nowrap;"';
        const tdS = 'style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px;"';
        const tdB = 'style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px; font-weight:700;"';
        reportHtml = `
        <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h2 style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:8px; font-size:18px;">
                세탁 거래명세서 (${h.name})
            </h2>
            <div style="text-align:right; margin-bottom:8px; font-size:12px; color:#64748b;">조회 기간: ${period}</div>
            <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; margin-top:5px; border:1px solid #cbd5e1; font-size:12px;">
                <thead><tr style="background:#f8fafc;">
                    <th ${thS}>일자</th>
                    ${allItems.map(n => `<th ${thS}>${n}</th>`).join('')}
                </tr></thead>
                <tbody>
                    ${allDates.map(d => `<tr>
                        <td ${tdB}>${d.slice(8)}</td>
                        ${allItems.map(n => `<td ${tdS}>${matrix[d][n]||0}</td>`).join('')}
                    </tr>`).join('')}
                    <tr><td ${tdB}>수량 합계</td>${allItems.map(n => `<td ${tdB}>${qtyTotals[n]}</td>`).join('')}</tr>
                    <tr><td ${tdB}>단가</td>${allItems.map(n => `<td ${tdS}>${(itemInfoMap[n]?.price||0).toLocaleString()}</td>`).join('')}</tr>
                    <tr style="background:#e0f2fe;">
                        <td ${tdB}>항목 합계</td>
                        ${allItems.map(n => {
                            const amt = priceTotals[n];
                            return `<td style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px; font-weight:700; color:#0369a1;">₩ ${amt.toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
            </div>
            <div style="margin-top:8px; padding:8px 12px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:13px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:14px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </div>`;
    }

    // 거래처 파트너 뷰일 때 정산확인 버튼 추가
    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

window.deleteSentInvoice = async function(sentAt) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    if(!confirm('정말 삭제하시겠습니까?')) return;
    const f = platformData.factories[currentFactoryId];
    f.sentInvoices = f.sentInvoices.filter(inv => inv.sentAt !== sentAt);
    saveData();
    window.loadAdminSentList();
};

// --- Admin Credentials & Global Notice Logic (SQL-First) ---
window.saveAdminCredentials = async function() {
    const id = document.getElementById('sa_id').value.trim();
    const pw = document.getElementById('sa_pw').value.trim();
    if(!id || !pw) { alert('ID와 비밀번호를 모두 입력하세요.'); return; }
    
    const { error } = await window.mySupabase.from('platform_settings')
        .upsert({ id: 'master_config', admin_id: id, admin_pw: pw });
        
    if (error) { alert('계정 저장 중 오류가 발생했습니다: ' + error.message); return; }
    
    alert('플랫폼 총괄 관리자 계정이 데이터베이스에 안전하게 변경/저장되었습니다.\\n새로운 계정으로 다시 로그인해 주세요.');
    location.reload();
};

window.saveNotice = async function() {
    const noticeContent = document.getElementById('globalNoticeInput').value.trim();
    
    // 플랫폼 설정 테이블의 기존 데이터를 조회해서 덮어씌움 방지
    const { data: currentSettings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
    
    const updateData = {
        id: 'master_config',
        global_notice: noticeContent
    };
    
    if (currentSettings) {
        updateData.admin_id = currentSettings.admin_id;
        updateData.admin_pw = currentSettings.admin_pw;
    }
    
    const { error } = await window.mySupabase.from('platform_settings').upsert(updateData);
    
    if (error) { alert('공지사항 저장 중 오류가 발생했습니다: ' + error.message); return; }
    
    alert(noticeContent ? '공지사항이 데이터베이스에 등록/업데이트 되었습니다.' : '공지사항이 삭제되었습니다.');
    window.loadGlobalNotice();
};

window.loadGlobalNotice = async function() {
    const bar = document.getElementById('globalNoticeBar');
    const input = document.getElementById('globalNoticeInput');
    
    const { data: settings } = await window.mySupabase.from('platform_settings').select('global_notice').eq('id', 'master_config').maybeSingle();
    const notice = settings && settings.global_notice ? settings.global_notice : '';
    
    if (input) input.value = notice;
    
    if (bar) {
        if (notice) {
            bar.innerText = notice;
            bar.style.display = 'block';
        } else {
            bar.style.display = 'none';
        }
    }
};

window.login_OLD = function() {
  try {
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');

    if(!roleEl || !idEl || !pwEl) return;

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const lPw = pwEl.value.trim();

    // 관리자 계정 확인
    const adminAuth = JSON.parse(localStorage.getItem('adminAuth')) || { id: 'admin', pw: '1111' };

    if (role === 'superadmin' && lId === adminAuth.id && lPw === adminAuth.pw) {
        showView('superAdminView', '플랫폼 총괄 관리자');
        return;
    }

    // 플랫폼 데이터가 정상 로드되었는지 확인
    if (!platformData || !platformData.factories) {
        console.error('플랫폼 데이터가 비어있습니다.');
        alert('데이터 로드 오류: 관리자에게 문의하세요.');
        return;
    }

    for (const fId in platformData.factories) {
        const f = platformData.factories[fId];
        if (role === 'admin' && f.adminId === lId && f.adminPw === lPw) {
            if (f.status === 'suspended') {
                alert('세탁공장 상태가 미운영 입니다. 관리자에게 문의하십시요');
                return;
            }
            currentFactoryId = fId;
            localStorage.setItem('currentFactoryId', fId); // [저장] 로그인 상태 유지
            showView('adminView', f.name + ' - 대표');
            return;
        }
        if (role === 'staff' && f.staffAccounts) {
            for (const sId in f.staffAccounts) {
                if (f.staffAccounts[sId].loginId === lId && f.staffAccounts[sId].loginPw === lPw) {
                    currentFactoryId = fId;
                    currentStaffName = f.staffAccounts[sId].name;
                    showView('staffView', f.name + ' - 현장직원');
                    loadStaffDashboard();
                    return;
                }
            }
        }
        if (role === 'hotel' && f.hotels) {
            for (const hId in f.hotels) {
                if (f.hotels[hId].loginId === lId && f.hotels[hId].loginPw === lPw) {
                    currentFactoryId = fId;
                    currentHotelId = hId;
                    console.log('Hotel login success:', f.hotels[hId].name);
                    showView('hotelView', f.hotels[hId].name);
                    loadHotelDashboard();
                    return;
                }
            }
        }
    }
    for (const reqId in platformData.pendingFactories) {
        if (platformData.pendingFactories[reqId].adminId === lId) {
            alert('아직 승인대기중 입니다. 잠시만 기다려주세요');
            return;
        }
    }
    alert('로그인 정보가 올바르지 않습니다.');
  } catch(e) {
    console.error('로그인 중 에러 발생:', e);
    alert('로그인 처리 중 에러가 발생했습니다: ' + e.message);
  }
};

// --- Password Recovery Logic ---
window.openFindPwModal = function() {
    console.log("openFindPwModal clicked!");
    document.getElementById('findPwId').value = '';
    document.getElementById('findPwPhone').value = '';
    openModal('findPwModal');
};

window.findAndResetPassword = async function() {
    const lId = document.getElementById('findPwId').value.trim();
    const phone = document.getElementById('findPwPhone').value.trim();

    if (!lId || !phone) {
        alert('아이디와 휴대폰 번호를 모두 입력해주세요.');
        return;
    }

    // 1. 공장 테이블에서 아이디로 먼저 조회 (전화번호 형식 하이픈 무시를 위함)
    const { data: factory, error } = await window.mySupabase
        .from('factories')
        .select('id, admin_id, phone')
        .eq('admin_id', lId)
        .maybeSingle();

    if (error || !factory) {
        alert('입력하신 아이디와 일치하는 계정을 찾을 수 없습니다.');
        return;
    }

    // 휴대폰 번호 하이픈 제거 후 비교
    const dbPhone = (factory.phone || '').replace(/-/g, '').trim();
    const inputPhone = phone.replace(/-/g, '').trim();

    if (dbPhone !== inputPhone) {
        alert('입력하신 아이디와 휴대폰 번호 정보가 일치하지 않습니다.');
        return;
    }

    // 2. 임시 비밀번호 생성 (6자리 숫자)
    const tempPw = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. DB 비밀번호 업데이트
    const { error: updateErr } = await window.mySupabase
        .from('factories')
        .update({ admin_pw: tempPw })
        .eq('id', factory.id);

    if (updateErr) {
        alert('비밀번호 초기화 중 오류가 발생했습니다: ' + updateErr.message);
        return;
    }

    // 4. 문자 발송 (임시 로직 - 실제로는 API 연동 필요)
    // TODO: 여기에 알리고, 쿨SMS 등 문자 발송 API 연동 코드를 추가하세요.
    console.log(`[SMS 발송 시뮬레이션] 수신번호: ${phone}, 내용: [Laundry Ops] 임시 비밀번호는 [${tempPw}] 입니다. 로그인 후 반드시 변경해주세요.`);
    
    alert(`임시 비밀번호가 문자로 발송되었습니다!\n(테스트 시뮬레이션: ${tempPw})`);
    closeModal('findPwModal');
};

// --- Registration Logic ---
window.openRegisterModal = function() {
  ['reg_name', 'reg_bizNo', 'reg_phone', 'reg_address', 'reg_id', 'reg_pw'].forEach(f => {
      const el = document.getElementById(f);
      if(el) { el.value = ''; el.classList.remove('error'); }
      const err = document.getElementById('err_' + f);
      if(err) err.style.display = 'none';
  });
  openModal('registerModal');
};

window.submitRegistration = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const fields = [
        { id: 'reg_name', err: 'err_reg_name' }, { id: 'reg_bizNo', err: 'err_reg_bizNo' },
        { id: 'reg_phone', err: 'err_reg_phone' }, { id: 'reg_address', err: 'err_reg_address' },
        { id: 'reg_id', err: 'err_reg_id' }, { id: 'reg_pw', err: 'err_reg_pw' }
    ];
    const regex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    let isValid = true, firstErrorEl = null;
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        const err = document.getElementById(f.err);
        const val = el.value.trim();
        if(!val) {
            el.classList.add('error');
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            if(!firstErrorEl) firstErrorEl = el;
            isValid = false;
        } else if((f.id === 'reg_id' || f.id === 'reg_pw') && !regex.test(val)) {
            el.classList.add('error');
            if(err) { err.innerText = "영문, 숫자, 특수문자만 가능합니다."; err.style.display = 'block'; }
            if(!firstErrorEl) firstErrorEl = el;
            isValid = false;
        } else {
            el.classList.remove('error');
            if(err) err.style.display = 'none';
        }
    });
    if(!isValid) { firstErrorEl.focus(); return; }

    const regId = document.getElementById('reg_id').value.trim();
    
    // DB에서 중복 ID 체크
    const { data: existingFactory } = await window.mySupabase.from('factories').select('id').eq('admin_id', regId).maybeSingle();
    if(existingFactory) { alert('이미 사용 중인 ID입니다.'); return; }
    
    const { data: existingPending } = await window.mySupabase.from('pending_factories').select('id').eq('admin_id', regId).maybeSingle();
    if(existingPending) { alert('이미 가입 신청 중인 ID입니다.'); return; }

    const reqId = 'req_' + Date.now();
    const newFactory = {
        id: reqId,
        name: document.getElementById('reg_name').value.trim(),
        biz_no: document.getElementById('reg_bizNo').value.trim(),
        phone: document.getElementById('reg_phone').value.trim(),
        address: document.getElementById('reg_address').value.trim(),
        admin_id: document.getElementById('reg_id').value.trim(),
        admin_pw: document.getElementById('reg_pw').value.trim(),
        status: 'operating',
        sub_status: 'trial',
        plan: '무료요금제',
        plan_expiry: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0],
        date: getTodayString()
    };
    
    const { error } = await window.mySupabase.from('pending_factories').insert([newFactory]);
    if (error) {
        alert('가입 신청 실패: ' + error.message);
        return;
    }

    closeModal('registerModal'); 
    alert('가입 신청이 완료되었습니다! 관리자 승인 후 로그인 가능합니다. 🐾');
};

// --- Staff Dashboard ---
// [v38 SQL-First] 레거시 platformData 완전 제거 - DB 쿼리 방식으로 통일
window.loadStaffDashboard = async function() {
    const invoiceDateEl = document.getElementById('invoiceDate');
    if (invoiceDateEl) invoiceDateEl.value = getTodayString();
    // [v38 수정] searchDate 초기값 비움 → 최근 50건 전체 표시 (날짜 입력 시 필터링)
    const searchDateEl = document.getElementById('staffSearchDate');
    if (searchDateEl) searchDateEl.value = '';
    if (typeof window.loadStaffHotelSelect === 'function') await window.loadStaffHotelSelect();
    if (typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
};

window.saveAndPrintInvoice = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if (!hId || !date) return;

    // 품목 수집 (item-price 셀에서 가격 읽기)
    const items = [];
    document.querySelectorAll('#staffInvoiceBody tr').forEach(tr => {
        const qtyInput = tr.querySelector('.inv-qty');
        if (!qtyInput) return;
        const q = Number(qtyInput.value);
        if (q === 0) return; // 0만 무시하고 마이너스(-) 허용
        const name = tr.cells[0]?.innerText?.trim();
        const priceCell = tr.querySelector('.item-price');
        const price = priceCell ? Number(priceCell.innerText.replace(/[^0-9-]/g, '')) : 0;
        if (name) items.push({ name, price, qty: q });
    });

    if (items.length === 0) { alert('수량을 입력해주세요.'); return; }

    const totalAmount = items.reduce((s, i) => s + (i.price * i.qty), 0);

    // 같은 날짜+거래처 명세서가 이미 있으면 업데이트, 없으면 insert
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        await window.mySupabase.from('invoices').update({
            total_amount: totalAmount,
            staff_name: currentStaffName || '현장직원'
        }).eq('id', invoiceId);
        await window.mySupabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    } else {
        // [추가] 신규 발행일 경우 요금제별 건수 제한 확인
        if (!await window.checkIssuanceLimit()) return;

        const { data: newInv, error: invErr } = await window.mySupabase.from('invoices').insert([{
            id: 'inv_' + Date.now(),
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalAmount,
            staff_name: currentStaffName || '현장직원',
            is_sent: false
        }]).select('id').single();
        if (invErr) { alert('저장 실패: ' + invErr.message); return; }
        invoiceId = newInv.id;
    }

    // invoice_items insert
    const itemRows = items.map(it => ({
        id: crypto.randomUUID(),
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty,
        unit: '개'
    }));
    const { error: itemErr } = await window.mySupabase.from('invoice_items').insert(itemRows);
    if (itemErr) { alert('품목 저장 실패: ' + itemErr.message); return; }

    const isEdit = !!existing;
    alert(isEdit ? '✏️ 수정 완료!' : '✅ 저장 완료!');

    // 폼 초기화
    document.getElementById('invoiceFormArea').style.display = 'none';
    document.getElementById('staffHotelSelect').value = '';
    const badge = document.getElementById('editModeBadge');
    if (badge) badge.style.display = 'none';

    if (typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
};

window.printReport = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    const printContent = el.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { border: 1px solid #ccc; padding: 8px; text-align: center; background: #eee; }
            td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        ${printContent}
    </body>
    </html>`);
    printWindow.document.close();
};



window.handleQtyKeydown = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.inv-qty'));
        const currentIndex = allInputs.indexOf(e.target);
        if (allInputs[currentIndex + 1]) {
            allInputs[currentIndex + 1].focus();
            // 모바일에서 select()가 씹히는 현상 방지를 위해 setTimeout 사용
            setTimeout(() => allInputs[currentIndex + 1].select(), 10);
        } else {
            document.getElementById('btnSaveInvoice').focus();
        }
    }
};

window.updateTrendChartOnly = async function() {

  // 6개월 추이 데이터 준비
  const base = new Date(curMonth + "-01");
  for(let i=5; i>=0; i--) {
      const d = new Date(base); d.setMonth(d.getMonth() - i);
      monthlyTrend[d.toISOString().substring(0, 7)] = 0;
  }

  (f.history || []).forEach(inv => {
      const isFiltered = (filterId === 'all' || inv.hotelId === filterId);
      const hotelInfo = f.hotels[inv.hotelId];
      // If hotelInfo is missing, we assume it's not fixed-rate, but for revenue reporting, it should probably be excluded?
      // Actually, if hotelInfo is missing, the invoice data might be stale. Let's just skip it if hotelInfo is null.
      if (!hotelInfo) return;

      const isFixed = (hotelInfo.contractType && hotelInfo.contractType.trim() === 'fixed');
      if (inv.hotelName.includes('준모텔')) console.log('DEBUG 준모텔:', inv.hotelName, 'isFixed=', isFixed, 'contractType=', hotelInfo.contractType);

      // 정액제 거래처인 경우, 발생한 명세서 합계는 매출 통계에서 제외 (기록만 남김)
      if (isFixed) return;

      // Today's Revenue (Contextual)
      if(inv.date === today && isFiltered) todayRevFiltered += inv.total;

      // Overall Monthly Sales (For Ranking & Cards) - Only sum if NOT fixed-rate
      if(inv.date.startsWith(curMonth) && !isFixed) {
          const key = hotelInfo.name;
          allSalesForRanking[key] = (allSalesForRanking[key] || 0) + inv.total;
          monthlyRevTotal += inv.total;
      }

      // Filtered Monthly Sales & Trend (For Chart)
      if(inv.date.startsWith(curMonth) && isFiltered) {
          monthlyRevFiltered += inv.total;
          hotelSalesFiltered[inv.hotelName] = (hotelSalesFiltered[inv.hotelName] || 0) + inv.total;
      }

      // Monthly Trend aggregation
      const m = inv.date.substring(0, 7);
      if(monthlyTrend[m] !== undefined) monthlyTrend[m] += isFiltered ? inv.total : 0;
  });

  // [정액제 매출 반영 로직] - 모든 정액제 거래처의 계약 금액을 무조건 매출에 포함
  for (const hId in (f.hotels || {})) {
      const h = f.hotels[hId];
      if (h.contractType === 'fixed') {
          const fixedAmt = Number(h.fixedAmount || 0);
          
          // Use createdAt to determine when this hotel started
          const createdMonth = h.createdAt ? h.createdAt.substring(0, 7) : '2000-01';
          
          if (curMonth >= createdMonth) {
              monthlyRevTotal += fixedAmt;
              allSalesForRanking[h.name] = fixedAmt;
          }

          // 월별 매출 추이에도 반영
          const isFiltered = (filterId === 'all' || filterId === hId);
          if (isFiltered) {
              for (const m in monthlyTrend) {
                  if (m >= createdMonth) {
                      monthlyTrend[m] += fixedAmt;
                  }
              }
          }
      }
      
      // 특정 거래처 필터링 시 과거 데이터 지우기 (단가/정액 모두 적용)
      if (filterId !== 'all' && filterId === hId) {
          const createdMonth = h.createdAt ? h.createdAt.substring(0, 7) : '2000-01';
          for (const m in monthlyTrend) {
              if (m < createdMonth) {
                  monthlyTrend[m] = null;
              }
          }
      }
  }

  if(document.getElementById('adminTodayRevenue')) document.getElementById('adminTodayRevenue').innerText = todayRevFiltered.toLocaleString() + '원';
  if(document.getElementById('adminMonthlyRevenue')) document.getElementById('adminMonthlyRevenue').innerText = monthlyRevTotal.toLocaleString() + '원'; // Use Total
  if(document.getElementById('adminSummaryCount')) document.getElementById('adminSummaryCount').innerText = `${Object.keys(f.hotels || {}).length} / ${Object.keys(f.staffAccounts || {}).length}`;

  // --- 성장률 계산 (전월 대비) ---
  const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1).toISOString().substring(0, 7);
  let prevMonthRev = 0;

  // 전월 매출은 필터와 관계없이 전체 합계로 계산해야 함
  (f.history || []).filter(inv => inv.date.startsWith(prevMonth)).forEach(inv => {
      prevMonthRev += inv.total;
  });

  let growthRate = 0;
  if (prevMonthRev > 0) {
      growthRate = ((monthlyRevTotal - prevMonthRev) / prevMonthRev) * 100; // Use Total
  } else if (monthlyRevTotal > 0 && prevMonthRev === 0) {
      growthRate = 100;
  }

  if(document.getElementById('adminGrowthRate')) {
      let displayRate = growthRate.toFixed(1) + '%';
      if (growthRate >= 0) {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--success);">&#9650; ${displayRate}</span>`; // Upward triangle (Green/Primary)
      } else {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--danger);">&#9660; ${Math.abs(growthRate).toFixed(1)}%</span>`; // Downward triangle (Red)
      }
  }
  // -----------------------------

  // Populate dropdowns
  ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
      const select = document.getElementById(id);
      if(select) {
          const currentVal = select.value;
          select.innerHTML = '<option value="all">전체 거래처</option>';
          for(const hId in f.hotels) select.innerHTML += `<option value="${hId}">${f.hotels[hId].name}</option>`;
          select.value = currentVal || 'all';
      }
  });

  // [복구] 만료 15일 전 경고 모달 로직
  console.log("DEBUG: Checking payment modal. f.planExpiry =", f.planExpiry);
  if (f.planExpiry) {
      const expiryDate = new Date(f.planExpiry);
      const today = new Date();
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log("DEBUG: diffDays =", diffDays);
      
      const isPending = platformData.pendingPayments && platformData.pendingPayments.some(p => p.factoryId === currentFactoryId);
      console.log("DEBUG: isPending =", isPending);
      
      if (isPending) {
          if (!sessionStorage.getItem('paymentChecked')) {
              alert('입금 내역을 관리자가 확인중입니다.');
              sessionStorage.setItem('paymentChecked', 'true');
              showView('adminView', f.name + ' - 대표');
          }
      } else if (diffDays <= 15) {
          const msg = diffDays < 0 ? `이용 기간이 만료되었습니다. 결제를 진행해주세요.` : `이용 기간이 ${diffDays}일 남았습니다. 결제를 진행해주세요.`;
          const paymentMsgEl = document.getElementById('paymentMsg');
          if(paymentMsgEl) {
              paymentMsgEl.innerText = msg;
              console.log("DEBUG: Showing paymentModal with msg:", msg);
              openModal('paymentModal');
          } else {
              console.error("DEBUG: paymentMsg element not found!");
          }
      }
  } else {
      console.log("DEBUG: f.planExpiry is missing");
  }

  // Update Ranking Title dynamically
  const rankingTitle = document.getElementById('rankingTitle');
  if(rankingTitle) rankingTitle.innerText = `${curMonth.replace('-', '-')} 거래처 매출 TOP 10`;

  // **FIX APPLIED HERE: Ranking uses allSalesForRanking, independent of filterId**
  const rankingArea = document.getElementById('adminTopRankingArea');
  if(rankingArea) {
      rankingArea.innerHTML = '';
      rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
      Object.entries(allSalesForRanking).sort((a,b) => b[1]-a[1]).slice(0, 10).map((f, i) => `
          <tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f[1].toLocaleString()}원</td></tr>
      `).join('') + '</tbody></table>';
  }

  window.updateRevenueTrendChart(monthlyTrend, filterId === 'all' ? '전체' : (f.hotels[filterId] ? f.hotels[filterId].name : '선택 거래처'));
  window.loadAdminRecentInvoices();
};

window.updateRevenueTrendChart = function(data, lab) {
  const canvas = document.getElementById('revenueTrendChart');
  if(!canvas) return;
  if(revenueTrendChart) revenueTrendChart.destroy();
  revenueTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
          labels: Object.keys(data).map(m => m.substring(5) + '월'),
          datasets: [{ label: lab + ' 매출', data: Object.values(data), borderColor: '#005b9f', backgroundColor: 'rgba(0, 91, 159, 0.1)', fill: true, tension: 0.3 }]
      },
      options: { responsive: true, plugins: { legend: { display: true } } }
  });
};


window.changePage = function(delta) {
    currentPage += delta;
    window.loadAdminRecentInvoices();
};

window.deleteInvoice = function(invId) {
    if(!confirm('정말 이 명세서를 삭제하시겠습니까?')) return;
    const f = platformData.factories[currentFactoryId];
    if(f && f.history) {
        f.history = f.history.filter(i => i.id != invId);
        saveData();
        loadAdminRecentInvoices();
        loadAdminDashboard();
        alert('삭제되었습니다.');
    }
};

window.checkInvoiceFilters = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    const sDate = document.getElementById('adminStatsStartDate');
    const eDate = document.getElementById('adminStatsEndDate');
    let isValid = true;
    [hotelFilter, sDate, eDate].forEach(el => {
        if(!el.value || el.value === 'all') { el.style.borderColor = 'red'; isValid = false; }
        else { el.style.borderColor = 'var(--border)'; }
    });
    return isValid;
};
window.exportInvoicesToPDF = function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hotelFilter];
    const isSpecial = h && h.hotelType === 'special';

    const list = window.loadAdminRecentInvoices(true).filter(inv => inv.date >= sDate && inv.date <= eDate);
    if(list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    // 일자별/품목별 데이터 집계
    const dailyData = {};
    const itemInfoMap = {}; // {name: {price, unit, category}}

    list.forEach(inv => {
        if (!inv.items) return; // defensive
        inv.items.forEach(it => {
            if (!it || !it.name) return; // defensive
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 카테고리별 2단 구성
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            // 일자별 수량 합계 계산
            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        // [일반거래처] 매트릭스 방식 디자인
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(reportHtml);
        win.document.close();
        setTimeout(() => win.print(), 500);
    }
};

window.OLD_sendInvoicesToClient_0 = function() {
    console.log('발송 시작');
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hotelFilter];
    const isSpecial = h && h.hotelType === 'special';

    if(!h) { console.error('거래처를 찾을 수 없습니다.'); alert('거래처 정보가 없습니다.'); return; }

    const list = window.loadAdminRecentInvoices(true).filter(inv => inv.date >= sDate && inv.date <= eDate);
    if(list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv || !inv.items || !Array.isArray(inv.items)) return;
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            if(!dailyData[inv.date][it.name]) dailyData[inv.date][it.name] = 0;
            dailyData[inv.date][it.name] += (it.qty || 0);
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];
            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name || '-'}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.qty || 0).toLocaleString()}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `<html><body>
            <h1 style="text-align:center;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        </body></html>`;

    } else {
        // [일반거래처] 매트릭스 방식 복원
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; }
            td { padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${d.substring(8)}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#e2e8f0; font-weight:700;">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background:#f1f5f9; font-weight:700;">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background:#fef3c7; font-weight:700;">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        </body></html>`;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    document.getElementById('sendInvBtn').onclick = function() {
        confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
    };
    openModal('sendInvoiceModal');
};


window.openHotelModal = function(hId = null) {
    editingHotelIdForInfo = hId;
    const modal = document.getElementById('hotelModal'),
          title = modal.querySelector('h3'),
          btn = modal.querySelector('.btn-save');

    // Clear/Reset fields
    ['h_name', 'h_ceo', 'h_phone', 'h_bizNo', 'h_address', 'h_fixedAmount', 'h_loginId', 'h_loginPw'].forEach(f => {
        const el = document.getElementById(f);
        if(el) { el.value = ''; el.classList.remove('error'); }
        const err = document.getElementById('err_' + f);
        if(err) err.style.display = 'none';
    });

    if (hId) {
        const h = platformData.factories[currentFactoryId].hotels[hId];
        title.innerText = '🤝 거래처 정보 수정';
        btn.innerText = '수정 완료';
        document.getElementById('h_name').value = h.name;
        document.getElementById('h_ceo').value = h.ceo || '';
        document.getElementById('h_phone').value = h.phone || '';
        document.getElementById('h_bizNo').value = h.bizNo || '';
        document.getElementById('h_address').value = h.address || '';
        document.getElementById('h_contractType').value = h.contractType;
        document.getElementById('h_fixedAmount').value = h.fixedAmount || '0';
        document.getElementById('h_loginId').value = h.loginId;
        document.getElementById('h_loginPw').value = h.loginPw;
        document.getElementById('h_fixedAmountGroup').style.display = h.contractType === 'fixed' ? 'block' : 'none';

        // [추가] 라디오 버튼 설정
        const typeRadios = document.getElementsByName('h_type');
        typeRadios.forEach(r => r.checked = (r.value === (h.hotelType || 'general')));

    } else {
        title.innerText = '🤝 신규 거래처 등록';
        btn.innerText = '거래처 등록';
        document.getElementById('h_contractType').value = 'unit';
        document.getElementById('h_fixedAmount').value = '0';
        window.toggleFixedAmountField();

        // [추가] 기본값 설정
        document.getElementsByName('h_type').forEach(r => r.checked = (r.value === 'general'));
    }
    openModal('hotelModal');
    setTimeout(() => document.getElementById('h_name').focus(), 100);
};

window.checkSpecialHotelAccess = async function(value) {
    if (value === 'special') {
        const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle();
        if (!await window.checkAccess('SPECIAL_HOTEL', f, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) {
            // 제한에 걸렸으므로 다시 일반으로 돌려놓는다
            document.querySelector('input[name="h_type"][value="general"]').checked = true;
        }
    }
};

window.saveNewHotel = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const f = platformData.factories[currentFactoryId],
          hName = document.getElementById('h_name').value.trim(),
          lId = document.getElementById('h_loginId').value.trim(),
          lPw = document.getElementById('h_loginPw').value.trim();

    // [추가] 라이트 요금제(레벨 1)일 경우 거래처 등록 제한
    if (getFactoryPlanLevel(f) === 1 && !editingHotelIdForInfo) {
        if (!await window.checkHotelLimit(f)) return;
    }

    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red'; // Apply red border immediately
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)'; // Reset border color
            if(err) err.style.display = 'none';
        }
    });

    if (document.getElementById('h_contractType').value === 'fixed' && !document.getElementById('h_fixedAmount').value.trim()) {
        document.getElementById('err_h_fixedAmount').style.display = 'block';
        document.getElementById('h_fixedAmount').style.borderColor = 'red';
        isValid = false;
    } else {
        document.getElementById('err_h_fixedAmount').style.display = 'none';
        document.getElementById('h_fixedAmount').style.borderColor = 'var(--border)';
    }

    if (!isValid) return;

    // Check ID Duplication
    for (const fid in platformData.factories) {
        if (platformData.factories[fid].adminId === lId) { alert('중복 ID!'); return; }
        for (const id in platformData.factories[fid].hotels) {
            if (platformData.factories[fid].hotels[id].loginId === lId && id !== editingHotelIdForInfo) {
                alert('중복 호텔 ID!'); return;
            }
        }
    }

    // [추가] 라디오 버튼 값
    const selectedType = document.querySelector('input[name="h_type"]:checked').value;

    // [추가] 특수거래처 제한 (엔터프라이즈 전용)
    if (selectedType === 'special') {
        if (!await window.checkAccess('SPECIAL_HOTEL', f, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) return;
    }

    if (editingHotelIdForInfo) {
        const h = f.hotels[editingHotelIdForInfo];
        h.name = hName;
        h.ceo = document.getElementById('h_ceo').value.trim();
        h.phone = document.getElementById('h_phone').value.trim();
        h.bizNo = document.getElementById('h_bizNo').value.trim();
        h.address = document.getElementById('h_address').value.trim();
        h.contractType = document.getElementById('h_contractType').value;
        h.fixedAmount = document.getElementById('h_fixedAmount').value;
        h.loginId = lId;
        h.loginPw = lPw;
        h.hotelType = selectedType; // 값 저장
    } else {
        const hId = 'h_' + Date.now();
        f.hotels[hId] = {
            id: hId,
            name: hName,
            ceo: document.getElementById('h_ceo').value.trim(),
            phone: document.getElementById('h_phone').value.trim(),
            bizNo: document.getElementById('h_bizNo').value.trim(),
            address: document.getElementById('h_address').value.trim(),
            contractType: document.getElementById('h_contractType').value,
            fixedAmount: document.getElementById('h_fixedAmount').value,
            loginId: lId,
            loginPw: lPw,
            hotelType: selectedType, // 값 저장
            items: selectedType === 'special' ? [] : JSON.parse(JSON.stringify(f.defaultItems || []))
        };
    }
    saveData();
    closeModal('hotelModal');
    loadAdminDashboard();
    loadAdminHotelList();
    editingHotelIdForInfo = null;
    alert('저장 완료!');
};

// 기존 함수 삭제 (아래의 async 버전으로 통합)

/*
window.loadHotelCategoryList = function() {
    // ...
};
*/

window.addHotelCategory = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const input = document.getElementById('new_h_cat_name');
    const cat = input.value.trim();
    if (!cat) return;

    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    if (!h.categories) h.categories = ['기타'];
    if (h.categories.includes(cat)) { alert('이미 존재하는 카테고리입니다.'); return; }

    h.categories.push(cat);
    saveData();
    input.value = '';
    loadHotelCategoryList();
};

window.deleteHotelCategory = function(cat) {
    if (!confirm('삭제하시겠습니까? 이 카테고리의 품목이 초기화될 수 있습니다.')) return;
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    h.categories = h.categories.filter(c => c !== cat);
    saveData();
    loadHotelCategoryList();
    loadHotelPriceList();
};

// [Removed legacy addHotelCustomItem]

// 기존 함수들 삭제 (아래에 최신 async 버전이 존재함)

window.deleteSimpleItem = function(name) {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    h.items = h.items.filter(i => i.name !== name);
    saveData();
    loadSimplePriceList();
};

// 기존 함수 삭제 (아래에 최신 async 버전이 존재함)

/*
window.loadHotelPriceList = function() {
    // ... (기존 레거시 코드)
};
*/

window.updateHotelItemPrice = async function(id, newPrice) {
    console.log("DEBUG: Updating hotel item price, ID:", id, "Price:", newPrice);
    
    // [Task 3] 정액제 거래처 확인
    const { data: item, error: itemErr } = await window.mySupabase.from('hotel_item_prices').select('hotel_id').eq('id', id).single();
    if (!itemErr && item) {
        const { data: hotel } = await window.mySupabase.from('hotels').select('contract_type').eq('id', item.hotel_id).single();
        if (hotel && hotel.contract_type === 'fixed') {
            if (!confirm('정액제 거래처입니다. 정말 단가를 수정하시겠습니까?')) {
                // 수정 취소 시 UI를 원래대로 되돌리는 처리가 필요할 수 있음
                window.loadHotelPriceList(); // 목록 새로고침
                return;
            }
        }
    }

    const { error } = await window.mySupabase.from('hotel_item_prices')
        .update({ price: Number(newPrice) || 0 })
        .eq('id', id);
        
    if (error) {
        alert('단가 수정 실패: ' + error.message);
        return;
    }
    
    console.log("DEBUG: Price updated successfully");
};

window.deleteHotelPrice = async function(itemName) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    if(!confirm('정말 삭제하시겠습니까?')) return;
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    h.items = h.items.filter(i => i.name !== itemName);
    saveData();
    loadHotelPriceList();
};
window.loadAdminHotelList = function() {
  platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };
  const f = platformData.factories[currentFactoryId], tbody = document.getElementById('adminHotelList'); if(!tbody || !f) return; tbody.innerHTML = '';
  for(const hId in (f.hotels || {})) {
      const h = f.hotels[hId];
      const badgeClass = h.contractType === 'fixed' ? 'badge-fixed' : 'badge-unit';
      const badgeText = h.contractType === 'fixed' ? '정액제' : '단가제';
      tbody.innerHTML += `<tr>
          <td><strong>${h.name}</strong></td>
          <td style="font-size:13px; color:var(--secondary);">${h.ceo || '-'}<br>${h.phone || '-'}</td>
          <td style="font-size:13px; color:var(--secondary);">${h.loginId}<br>****</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>
              <button class="btn-mng btn-info" onclick="openHotelModal('${hId}')">정보수정</button>
              <button class="btn-mng btn-price" onclick="openPriceSetting('${hId}')">단가수정</button>
              <button class="btn-mng btn-del" onclick="deleteHotel('${hId}')">삭제</button>
          </td>
      </tr>`;
  }
};
window.deleteHotel = async function(hId) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 if(confirm('삭제?')) { delete platformData.factories[currentFactoryId].hotels[hId]; saveData(); window.loadAdminHotelList(); } };
window.OLD_loadAdminStaffList_0 = async function() {
    const tbody = document.getElementById('adminStaffList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">직원 목록을 불러오는 중...</td></tr>';

    const { data: staffList, error: sErr } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(sErr) { tbody.innerHTML = `<tr><td colspan="3" style="color:red;">에러: ${sErr.message}</td></tr>`; }
    else if(!staffList || staffList.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">등록된 직원이 없습니다.</td></tr>'; }
    else {
        tbody.innerHTML = '';
        staffList.forEach(s => {
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td style="font-size:13px;">${s.login_id}<br><small style="color:var(--secondary)">PW: ${s.login_pw}</small></td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td>
            </tr>`;
        });
    }

    // Load recent invoices
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;
    
    // pagination for staff activity list
    const itemsPerPage = 10;
    window.currentStaffPage = window.currentStaffPage || 1;
    const startIdx = (window.currentStaffPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage - 1;

    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        .order('created_at', { ascending: false })
        .range(startIdx, endIdx);

    if(iErr) { activityBody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${iErr.message}</td></tr>`; }
    else {
        const filteredInvoices = invoices ? invoices.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if(filteredInvoices.length === 0) {
            activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>';
        } else {
            activityBody.innerHTML = '';
            filteredInvoices.forEach(inv => {
            const displaySum = inv.total_amount || 0;
            const hName = (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음';
            activityBody.innerHTML += `<tr>
                <td style="font-size:12px;">${inv.date}</td>
                <td>${inv.staff_name || '직원'}</td>
                <td><strong>${hName}</strong></td>
                <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
            </tr>`;
        });
        
        // Update pagination UI
        const totalPages = Math.ceil((count || 0) / itemsPerPage);
        const paginationContainer = document.getElementById('adminStaffPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = `
                <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(-1)" ${window.currentStaffPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                    <span style="font-weight: 600; color: #64748b;">${window.currentStaffPage} / ${totalPages || 1}</span>
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(1)" ${window.currentStaffPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
                </div>
            `;
        }
    }
};

window.changeStaffPage = function(delta) {
    currentStaffPage += delta;
    window.loadAdminStaffList();
};
window.deleteStaff = async function(sId) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 if(confirm('삭제?')) { delete platformData.factories[currentFactoryId].staffAccounts[sId]; saveData(); window.loadAdminStaffList(); } };
window.openStaffModal = async function() {
  // [추가] 라이트 요금제(레벨 1)일 경우 직원 관리 제한 (비즈니스 이상 필요)
  if (!await window.checkAccess('STAFF_MANAGEMENT', null, '라이트 요금제에서 직원등록은 1명 입니다. [요금제 업그레이드] 해주세요')) return;

  ['st_name', 'st_loginId', 'st_loginPw'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
      const err = document.getElementById('err_' + id);
      if(err) err.style.display = 'none';
  });
  openModal('staffModal');
};
window.saveNewStaff = async function() {
    // [추가] 요금제 제한 확인
    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkStaffLimit(f)) return;

    const nameInput = document.getElementById('st_name');
    const idInput = document.getElementById('st_loginId');
    const pwInput = document.getElementById('st_loginPw');

    const name = nameInput.value.trim();
    const lId = idInput.value.trim();
    const lPw = pwInput.value.trim();

    let isValid = true;
    if (!name) { nameInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_name').style.display = 'block'; isValid = false; }
    else { nameInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_name').style.display = 'none'; }
    if (!lId) { idInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginId').innerText = 'ID를 입력해주세요.'; document.getElementById('err_st_loginId').style.display = 'block'; isValid = false; }
    else { idInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_loginId').style.display = 'none'; }
    if (!lPw) { pwInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginPw').style.display = 'block'; isValid = false; }
    else { pwInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_loginPw').style.display = 'none'; }
    if (!isValid) return;

    // ID 중복 체크 (DB)
    const { data: exist } = await window.mySupabase.from('staff').select('id').eq('factory_id', currentFactoryId).eq('login_id', lId).maybeSingle();
    if (exist) {
        idInput.style.borderColor = 'var(--danger)';
        document.getElementById('err_st_loginId').innerText = '이미 존재하는 ID입니다.';
        document.getElementById('err_st_loginId').style.display = 'block';
        return;
    }

    const { error } = await window.mySupabase.from('staff').insert([{
        id: 'st_' + Date.now(),
        factory_id: currentFactoryId,
        name: name,
        login_id: lId,
        login_pw: lPw
    }]);

    if (error) {
        alert('등록 실패: ' + error.message);
    } else {
        closeModal('staffModal');
        window.loadAdminStaffList();
        alert('직원 등록이 완료되었습니다.');
    }
};
window.openDefaultPriceSetting = function() { openModal('defaultPriceModal'); window.loadAdminDefaultPriceList(); };
window.loadAdminDefaultPriceList = function() {
  const f = platformData.factories[currentFactoryId], tbody = document.getElementById('adminDefaultPriceList'); if(!tbody || !f) return; tbody.innerHTML = '';
  (f.defaultItems || []).forEach((item, idx) => tbody.innerHTML += `<tr style="height:35px;"><td style="padding:4px 8px;">${item.name}</td><td style="padding:4px 8px;">${item.price.toLocaleString()}원</td><td style="padding:4px 8px;">${item.unit}</td><td style="padding:4px 8px;"><button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice(${idx})">삭제</button></td></tr>`);
};
window.saveDefaultPrice = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

  console.log('단가 저장 시도');
  const f = platformData.factories[currentFactoryId];
  const nameEl = document.getElementById('dp_name');
  const priceEl = document.getElementById('dp_price');
  const unitEl = document.getElementById('dp_unit');

  const name = nameEl.value.trim();
  const price = Number(priceEl.value) || 0;
  const unit = unitEl.value.trim() || '개';

  console.log('입력값:', name, price, unit);

  if(!name) { alert('품목명 입력!'); return; }
  if(!f.defaultItems) f.defaultItems = [];
  f.defaultItems.push({ name: name, price: price, unit: unit });

  saveData();
  window.loadAdminDefaultPriceList();

  // 입력창 초기화
  nameEl.value = '';
  priceEl.value = '0';
  unitEl.value = '개';
  nameEl.focus();
  console.log('저장 완료');
};
window.deleteDefaultPrice = async function(idx) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 platformData.factories[currentFactoryId].defaultItems.splice(idx, 1); saveData(); window.loadAdminDefaultPriceList(); };

// --- Super Admin ---
/* cleaned up old super admin code */
window.loadPendingFactories = async function() {
    const tbody = document.getElementById('pendingFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">데이터를 불러오는 중...</td></tr>';
    
    const { data: pending, error } = await window.mySupabase.from('pending_factories').select('*');
    if (error) {
        console.error("DEBUG: loadPendingFactories error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
        return;
    }
    
    if (!pending || pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">신청된 데이터가 없습니다.</td></tr>';
    } else {
        tbody.innerHTML = '';
        pending.forEach(p => {
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.biz_no}</td><td>${p.phone}</td><td>${p.address}</td><td><button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="approveFactory('${p.id}')">승인</button><button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectFactory('${p.id}')">반려</button></td></tr>`;
        });
    }
};

window.approveFactory = async function(reqId) {
    const { data: p, error: pErr } = await window.mySupabase.from('pending_factories').select('*').eq('id', reqId).maybeSingle();
    if (pErr || !p) { alert('신청 데이터를 찾을 수 없습니다.'); return; }
    
    // Supabase DB에 직접 삽입 전 중복 ID 체크
    const { data: existing, error: checkErr } = await window.mySupabase.from('factories').select('id').eq('admin_id', p.admin_id).maybeSingle();
    if (checkErr) { alert('중복 체크 중 오류 발생: ' + checkErr.message); return; }
    if (existing) { alert('이미 같은 관리자 ID(' + p.admin_id + ')를 사용하는 공장이 있습니다.'); return; }

    const fId = 'f_' + Date.now();
    const expiryDate = new Date(p.date || new Date());
    expiryDate.setMonth(expiryDate.getMonth() + 5);
    const planExpiry = expiryDate.toISOString().split('T')[0];

    const { error } = await window.mySupabase.from('factories').insert([{
        id: fId,
        name: p.name,
        admin_id: p.admin_id,
        admin_pw: p.admin_pw,
        ceo: p.name + ' 대표',
        phone: p.phone,
        address: p.address,
        status: 'operating',
        created_at: p.date || getTodayString(),
        sub_status: 'trial', 
        plan: '무료요금제',
        plan_expiry: planExpiry
    }]);

    if (error) {
        alert('승인 중 오류 발생: ' + error.message);
        return;
    }

    // pending_factories에서 삭제
    await window.mySupabase.from('pending_factories').delete().eq('id', reqId);
    
    window.loadSuperAdminDashboard();
    alert('성공적으로 승인되었습니다.');
};

window.rejectFactory = async function(reqId) {
    if(confirm('정말 반려(삭제)하시겠습니까?')) {
        const { error } = await window.mySupabase.from('pending_factories').delete().eq('id', reqId);
        if (error) { alert('삭제 실패: ' + error.message); return; }
        window.loadSuperAdminDashboard();
    }
};
window.updateFactoryStatus = async function(fId, s) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 platformData.factories[fId].status = s; saveData(); loadSuperAdminDashboard(); };
window.deleteFactory = async function(fId) {
    if(confirm('정말 이 세탁공장을 삭제하시겠습니까? 관련된 모든 데이터(거래처, 명세서)가 연쇄적으로 영구 삭제됩니다!')) {
        const { error } = await window.mySupabase.from('factories').delete().eq('id', fId);
        if (error) { alert('삭제 중 오류가 발생했습니다: ' + error.message); return; }
        
        window.loadSuperAdminDashboard();
        alert('공장이 성공적으로 삭제되었습니다.');
    }
};

window.openFactoryAdminView = function(fId) {
    localStorage.setItem('adminAccessFactoryId', fId);
    let currentPath = window.location.pathname.split('/').pop();
    if (!currentPath || currentPath === '') currentPath = 'index.html'; // [수정] v37 하드코딩 제거, 기본 index.html
    window.open(currentPath, '_blank');
};

window.viewFactoryDetails = async function(fId, isSuperAdmin = false) {
    editingFactoryId = fId;
    const { data: f, error } = await window.mySupabase.from('factories').select('*').eq('id', fId).single();
    if(error || !f) { alert('데이터를 불러올 수 없습니다.'); return; }
    document.getElementById('s_factoryName').value = f.name;
    document.getElementById('s_adminId').value = f.admin_id;
    document.getElementById('s_adminPw').value = f.admin_pw;
    document.getElementById('s_ceo').value = f.ceo || '';
    document.getElementById('s_phone').value = f.phone || '';
    document.getElementById('s_address').value = f.address || '';
    document.getElementById('s_bankInfo').value = f.bank_info || '';
    document.getElementById('s_memo').value = f.memo || '';
    document.getElementById('s_plan').value = f.plan || '라이트';
    document.getElementById('s_planExpiry').value = f.plan_expiry || '';
    document.getElementById('s_subStatus').value = f.sub_status || 'active';
    document.getElementById('s_status').value = f.status || 'operating';
    document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
    openModal('factoryModal');
};
window.openFactoryModal = function(isSuperAdmin = false) {
  editingFactoryId = null;
  ['s_factoryName', 's_adminId', 's_adminPw', 's_ceo', 's_phone', 's_address', 's_bankInfo', 's_memo', 's_plan', 's_planExpiry', 's_status'].forEach(f => {
      const el = document.getElementById(f);
      if(el) { el.value = ''; el.classList.remove('error'); }
      const err = document.getElementById('err_' + f);
      if(err) err.style.display = 'none';
  });
  document.getElementById('s_plan').value = '무료요금제';
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 5);
  document.getElementById('s_planExpiry').value = expiryDate.toISOString().split('T')[0];
  document.getElementById('s_subStatus').value = 'trial';
  document.getElementById('s_status').value = 'operating';
  document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
  openModal('factoryModal');
};

window.saveNewFactory = async function() {
  const fields = [{ id: 's_factoryName', err: 'err_s_factoryName' }, { id: 's_adminId', err: 'err_s_adminId' }, { id: 's_adminPw', err: 'err_s_adminPw' }];
  let isValid = true;
  fields.forEach(f => {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.err);
      if (!el.value.trim()) { el.classList.add('error'); if(err) err.style.display = 'block'; isValid = false; } else { el.classList.remove('error'); if(err) err.style.display = 'none'; }
  });
  if (!isValid) return;

  const newId = document.getElementById('s_adminId').value.trim();
  const { data: existing } = await window.mySupabase.from('factories').select('id').eq('admin_id', newId).maybeSingle();

  if (existing && existing.id !== editingFactoryId) {
      alert('이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.');
      return;
  }

  const factoryData = {
      name: document.getElementById('s_factoryName').value.trim(),
      admin_id: document.getElementById('s_adminId').value.trim(),
      admin_pw: document.getElementById('s_adminPw').value.trim(),
      ceo: document.getElementById('s_ceo').value.trim(),
      phone: document.getElementById('s_phone').value.trim(),
      address: document.getElementById('s_address').value.trim(),
      bank_info: document.getElementById('s_bankInfo').value.trim(),
      memo: document.getElementById('s_memo').value.trim(),
      plan: document.getElementById('s_plan').value,
      plan_expiry: document.getElementById('s_planExpiry').value || null,
      sub_status: document.getElementById('s_subStatus').value,
      status: document.getElementById('s_status').value
  };

  // [v37 자동화] 만료일 기준 구독 상태 자동 결정
  // 사장님 요청: 플랫폼 관리자가 '무료체험'으로 '수동 지정'한 경우, 
  // 만료일 로직(active 덮어쓰기)을 무시하고 관리자의 선택(무료체험)을 최우선으로 존중해야 함.
  if (factoryData.plan_expiry) {
      if (!editingFactoryId) {
          // 신규 등록 시 무조건 무료체험
          factoryData.sub_status = 'trial';
      } else {
          // 기존 수정일 때
          const expiryDate = new Date(factoryData.plan_expiry);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // 시간 제외

          if (expiryDate < today) {
              factoryData.sub_status = 'expired';
          } else {
              const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays <= 15) {
                  // 임박한 경우, 선택한 것이 '무료체험'이든 뭐든 무조건 '만료임박'으로 덮어씀!
                  factoryData.sub_status = 'expiring';
              } else {
                  // 15일 이상 넉넉할 때 (결제 연장 등)
                  // 단, 관리자가 폼에서 'trial' (무료체험)을 명시적으로 골랐다면, 그걸 덮어쓰지 말고 존중한다.
                  if (factoryData.sub_status !== 'trial') {
                      factoryData.sub_status = 'active';
                  }
              }
          }
      }
  }

  let error;
  if (editingFactoryId) {
      const { error: err } = await window.mySupabase.from('factories').update(factoryData).eq('id', editingFactoryId);
      error = err;
  } else {
      factoryData.id = 'f_' + Date.now();
      factoryData.status = 'operating';
      factoryData.created_at = new Date().toISOString();
      const { error: err } = await window.mySupabase.from('factories').insert(factoryData);
      error = err;
  }

  if (error) { alert('저장 실패: ' + error.message); return; }
  await window.fetchFromSupabase(); // [v33 안전 동기화] 저장 후 최신 데이터 동기화
  alert('저장 완료!');
  closeModal('factoryModal');
  loadSuperAdminDashboard();
};

// [v38 SQL-First] 거래처 파트너 대시보드 - 레거시 platformData 완전 제거
// [v38 SQL-First] 거래처 파트너 대시보드
window.loadHotelDashboard = async function() {
    const el = (id) => document.getElementById(id);



    // 1. 거래처 정보 조회 (공장 정보는 별도 조회 - FK join 의존 제거)
    const { data: hData, error: hErr } = await window.mySupabase
        .from('hotels')
        .select('*')
        .eq('id', currentHotelId)
        .single();

    if (!hData) return;

    // 공장 정보 별도 조회
    const { data: fData } = await window.mySupabase
        .from('factories')
        .select('name, phone, ceo')
        .eq('id', hData.factory_id)
        .single();

    // 헤더 세팅
    if (el('hotelNameTitle')) el('hotelNameTitle').innerText = hData.name;
    if (el('h_factoryPhone')) el('h_factoryPhone').innerText = fData?.phone || '-';
    if (el('h_factoryCeo')) el('h_factoryCeo').innerText = fData?.ceo || '-';
    const contractText = hData.contract_type === 'fixed'
        ? `정액제 (월 ${Number(hData.fixed_amount || 0).toLocaleString()}원)` : '단가제';
    if (el('hotelContractInfo')) el('hotelContractInfo').innerText = contractText;

    // 2. 조회 월 세팅
    const statsInp = el('hotelInvoiceMonth');
    const sMonth = statsInp?.value || getTodayString().substring(0, 7);
    if (statsInp) statsInp.value = sMonth;
    const sMonthStart = sMonth + '-01';
    // 월말 날짜 정확 계산 (4월=30일, 2월=28/29일 등 대응)
    const [sY, sM] = sMonth.split('-').map(Number);
    const lastDay = new Date(sY, sM, 0).getDate(); // 다음달 0일 = 이번달 말일
    const sMonthEnd = sMonth + '-' + String(lastDay).padStart(2, '0');

    // 3. 해당 월 invoices 조회 (금액 통계 + 목록용)
    const { data: invList } = await window.mySupabase
        .from('invoices')
        .select('id, date, total_amount')
        .eq('hotel_id', currentHotelId)
        .gte('date', sMonthStart)
        .lte('date', sMonthEnd)
        .order('date', { ascending: false });

    // 목록 렌더링 + 통계 집계
    const tbody = el('hotelInvoiceList');
    if (tbody) tbody.innerHTML = '';
    let total = 0, count = 0;

    (invList || []).forEach(inv => {
        const invSum = Number(inv.total_amount || 0);
        total += invSum;
        count++;
        if (tbody) {
            tbody.innerHTML += `<tr>
                <td>${inv.date}</td>
                <td style="text-align:right;">${invSum.toLocaleString()}원</td>
                <td><span class="badge" style="background:var(--success)">입고완료</span></td>
                <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
            </tr>`;
        }
    });
    if (tbody && tbody.innerHTML === '') {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:30px; color:gray;">${sMonth} 입고 내역 없음</td></tr>`;
    }

    // 카드 업데이트
    if (el('hotelMonthlyTotal')) el('hotelMonthlyTotal').innerText = total.toLocaleString() + '원';
    if (el('hotelMonthlyCount')) el('hotelMonthlyCount').innerText = count + '회';

    // 4. 품목 통계 - invoice_items 별도 조회 (해당 월 invoice id 목록 기반)
    const invIds = (invList || []).map(inv => inv.id);
    const itemStats = {};
    if (invIds.length > 0) {
        const { data: itemRows } = await window.mySupabase
            .from('invoice_items')
            .select('name, qty')
            .in('invoice_id', invIds);
        (itemRows || []).forEach(it => {
            itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty || 0);
        });
    }
    if (el('hotelTopItem')) {
        const top = Object.entries(itemStats).sort((a, b) => b[1] - a[1])[0];
        el('hotelTopItem').innerText = top ? `${top[0]} (${top[1]}개)` : '-';
    }

    // 5. 6개월 추이 - 독립 쿼리 (이중 계산 없음)
    const monthlyTrend = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(sMonth + '-01');
        d.setMonth(d.getMonth() - i);
        monthlyTrend[d.toISOString().substring(0, 7)] = 0;
    }
    const trendStart = Object.keys(monthlyTrend)[0] + '-01';
    const { data: trendData } = await window.mySupabase
        .from('invoices')
        .select('date, total_amount')
        .eq('hotel_id', currentHotelId)
        .gte('date', trendStart)
        .lte('date', sMonthEnd);
    (trendData || []).forEach(inv => {
        const m = inv.date.substring(0, 7);
        if (monthlyTrend[m] !== undefined) monthlyTrend[m] += Number(inv.total_amount || 0);
    });

    updateHotelItemChart(itemStats);
    updateHotelTrendChart(monthlyTrend);

    // 6. 정산 리포트 수신함
    window.loadHotelReceivedInvoicesList();
};

window.updateHotelItemChart = function(stats) {
    const canvas = document.getElementById('hotelItemPieChart');
    const msg = document.getElementById('hotelNoChartMsg');
    if (!canvas || !msg) return; // 요소가 없으면 에러 없이 종료

    if(Object.keys(stats).length === 0) { canvas.style.display = 'none'; msg.style.display = 'block'; return; }
    canvas.style.display = 'block'; msg.style.display = 'none';
    if(hotelItemChart) hotelItemChart.destroy();
    hotelItemChart = new Chart(canvas, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#005b9f','#00a8e8','#8b5cf6','#10b981','#f59e0b','#ef4444','#64748b'] }] }, options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } } });
};

// [v38 SQL-First] 첫 번째 레거시 loadHotelReceivedInvoicesList 제거됨

window.updateHotelTrendChart = function(data) {
    const canvas = document.getElementById('hotelTrendBarChart');
    if(!canvas) return;
    if(hotelTrendChart) hotelTrendChart.destroy();
    hotelTrendChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Object.keys(data).map(m => m.substring(5) + '월'),
            datasets: [{ label: '월별 매출', data: Object.values(data), backgroundColor: '#005b9f' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
};


window.toggleFixedAmountField = function() {
    const type = document.getElementById('h_contractType').value;
    const group = document.getElementById('h_fixedAmountGroup');
    if (group) group.style.display = (type === 'fixed' ? 'block' : 'none');
};

let selectedPlan = '', selectedPrice = 0;

window.selectPlan = function(name, price) {
    selectedPlan = name;
    selectedPrice = price;
    
    // 모든 결제 폼 내의 요금제 이름 업데이트
    const planNameEls = document.querySelectorAll('#selectedPlanName');
    planNameEls.forEach(el => el.innerText = name);
    
    const formArea = document.getElementById('paymentModalFormArea') || document.getElementById('paymentFormArea');
    if(formArea) formArea.style.display = 'block';
    calculatePaymentTotal();
};

window.calculatePaymentTotal = function() {
    // 화면에 보여지고 있는 폼의 입력값만 가져오기 (결제 모달 우선)
    const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    const monthsEl = activeModal ? activeModal.querySelector('#pay_months') : document.getElementById('pay_months');
    const taxEl = activeModal ? activeModal.querySelector('#pay_tax') : document.getElementById('pay_tax');
    const totalDisplay = activeModal ? activeModal.querySelector('#pay_total_display') : document.getElementById('pay_total_display');
    
    if(!monthsEl || !totalDisplay) {
        console.error("DEBUG: calculatePaymentTotal elements not found");
        return;
    }

    const months = parseInt(monthsEl.value);
    const taxChecked = taxEl ? taxEl.checked : false;
    
    let discount = 0;
    if (months === 3) discount = 0.05;
    else if (months === 6) discount = 0.10;
    else if (months === 12) discount = 0.20;
    
    let subtotal = Math.floor(selectedPrice * months * (1 - discount));
    let total = subtotal;
    
    if (taxChecked) {
        total = Math.floor(subtotal * 1.1);
    }
    
    totalDisplay.innerText = total.toLocaleString() + '원' + (taxChecked ? ' (VAT 포함)' : '');
};

window.submitPaymentRequest = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    // 활성화된 모달이나 탭 영역에서 요소 찾기
    const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    const depositorEl = activeModal ? activeModal.querySelector('#pay_depositor') : document.getElementById('pay_depositor');
    const monthsEl = activeModal ? activeModal.querySelector('#pay_months') : document.getElementById('pay_months');
    const taxEl = activeModal ? activeModal.querySelector('#pay_tax') : document.getElementById('pay_tax');
    
    const depositor = depositorEl ? depositorEl.value.trim() : '';
    const months = parseInt(monthsEl.value);
    const tax = taxEl ? taxEl.checked : false;
    
    if (!depositor) { alert('입금자명을 입력해주세요.'); return; }
    
    let discount = 0;
    if (months === 3) discount = 0.05;
    else if (months === 6) discount = 0.10;
    else if (months === 12) discount = 0.20;
    
    let subtotal = Math.floor(selectedPrice * months * (1 - discount));
    const total = tax ? Math.floor(subtotal * 1.1) : subtotal;
    
    // Supabase에 직접 삽입하도록 수정
    const { error } = await window.mySupabase.from('pending_payments').insert([{
        id: 'pay_' + Date.now(),
        factory_id: currentFactoryId,
        factory_name: platformData.factories[currentFactoryId].name,
        plan: selectedPlan,
        months: months,
        total: total,
        request_tax_invoice: tax,
        depositor_name: depositor,
        date: getTodayString()
    }]);

    if (error) {
        alert('결제 신청 실패: ' + error.message);
        return;
    }
    
    // 로컬 데이터는 동기화용으로만 업데이트 (또는 fetch로 다시 불러오기)
    await window.fetchFromSupabase();
    alert('결제 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
    
    // 모달과 탭 폼 모두 닫기
    const modalForm = document.getElementById('paymentModalFormArea');
    const tabForm = document.getElementById('paymentFormArea');
    if (modalForm) modalForm.style.display = 'none';
    if (tabForm) tabForm.style.display = 'none';
    
    closeModal('paymentDirectModal');
    
    // 결제 신청 후 메인 통계 탭으로 자동 전환
    const statsTabBtn = document.querySelector('.tab-item[onclick="switchTab(this, \'adminStats\')"]');
    if (statsTabBtn) {
        window.switchTab(statsTabBtn, 'adminStats');
    }
};

// [v38 SQL-First] 두 번째 레거시 loadHotelReceivedInvoicesList 제거됨

window.printReport = function(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write('<html><head><style>body{font-family:sans-serif; padding:20px;} table{width:100%; border-collapse:collapse; margin-top:10px;} th,td{border:1px solid #ccc; padding:8px; text-align:center;} .total-row{font-weight:bold; background:#eee;}</style></head><body>' + htmlContent + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};


window.viewSentReportByPeriod = function(period, sentAt) {
    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[currentHotelId];
    const sentInv = f.sentInvoices.find(s => s.period === period && s.hotelName === h.name);
    const [sDate, eDate] = period.split(' ~ ');
    const list = f.history.filter(inv => inv.hotelId === currentHotelId && inv.date >= sDate && inv.date <= eDate && inv.isSent === true);

    // sentAt을 이용해 고유 정산 상태 확인
    const isConfirmed = h.confirmedMonths && (h.confirmedMonths[sentAt] === true);

    const itemsList = h.items || [];
    const itemNames = itemsList.map(i => i.name);

    const dateSequence = [];
    let curDate = new Date(sDate);
    const endDate = new Date(eDate);
    while (curDate <= endDate) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    dateSequence.forEach(d => dailyData[d] = {});
    list.forEach(inv => {
        if(!dailyData[inv.date]) dailyData[inv.date] = {};
        inv.items.forEach(it => {
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
        });
    });

    const totals = {};
    itemNames.forEach(name => {
        totals[name] = { qty: 0, price: itemsList.find(i => i.name === name).price };
        dateSequence.forEach(d => totals[name].qty += (dailyData[d][name] || 0));
        totals[name].amount = totals[name].qty * totals[name].price;
    });
    // 저장된 데이터를 우선 사용하고 없으면 재계산
    const supplyPrice = sentInv ? sentInv.supplyPrice : list.reduce((sum, inv) => sum + inv.total, 0);
    const vat = sentInv ? sentInv.vat : Math.floor(supplyPrice * 0.1);
    const total = sentInv ? sentInv.totalAmount : (supplyPrice + vat);

    const reportHtml = `
    <div id='sent-report-to-print' style="font-family:'Malgun Gothic', sans-serif; padding:20px;">
        <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">거래처 발송용 명세서 (${h.name})</h1>
        <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">조회 기간: ${period}</div>
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; min-width: 600px;">
            <thead>
                <tr>
                    <th style="background: #f1f5f9; color: #475569; font-weight: 700; padding: 4px; font-size: 11px; border: 1px solid #cbd5e1;">일자</th>
                    ${itemNames.map(name => `<th style="background: #f1f5f9; color: #475569; font-weight: 700; padding: 4px; font-size: 11px; border: 1px solid #cbd5e1;">${name}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${dateSequence.map(d => `
                    <tr>
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 600; background: #f8fafc;">${parseInt(d.substring(8))}</td>
                        ${itemNames.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${dailyData[d][name] || '0'}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="font-weight: 700; background: #e2e8f0;">
                    <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">수량 합계</td>
                    ${itemNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${totals[name].qty}</td>`).join('')}
                </tr>
                <tr style="font-weight: 700; background: #fef3c7;">
                    <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">항목 합계</td>
                    ${itemNames.map(name => `<td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">₩ ${totals[name].amount.toLocaleString()}</td>`).join('')}
                </tr>
            </tfoot>
        </table>
        <div style="margin-top: 20px; padding: 15px; border: 2px solid #005b9f; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background: #eff6ff;">
            <div style="font-size: 14px; font-weight: 700;">공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총합계: ₩ ${total.toLocaleString()}</div>
        </div>
    </div>

    <div style="margin-top: 30px; text-align: center; display:flex; justify-content:center; gap:10px;" class="no-print">
        ${!isConfirmed ? `<button class="btn btn-save no-print" style="width:200px; padding:15px; background:#10b981; border:none; color:white; font-weight:700;" onclick="confirmSentReportByPeriod('${sentAt}')">✅ 정산 확인 완료</button>` : '<div style="color: var(--success); font-weight: 700;">✅ 이미 확인된 내역입니다.</div>'}
        <button class="btn btn-neutral no-print" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};


window.confirmSentReportByPeriod = async function(sentAt) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    console.log("DEBUG: Confirming settlement for sentAt:", sentAt);
    // 로컬스토리지에서 최신 데이터 로드
    platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };

    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[currentHotelId];
    if(!h.confirmedMonths) h.confirmedMonths = {};

    h.confirmedMonths[sentAt] = true;

    saveData();

    // 모달창 강제 닫기
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => m.style.display = 'none');

    loadHotelReceivedInvoicesList(); // 리스트 갱신
};

window.handleAdminFilterChange = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    if (hotelFilter === 'all') {
        document.getElementById('adminStatsStartDate').value = '';
        document.getElementById('adminStatsEndDate').value = '';
    }
    loadAdminRecentInvoices();
};

window.printReport = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    // 요소 복제
    const clone = el.cloneNode(true);

    // 인쇄 시 불필요한 요소 제거 (btn-send, no-print 클래스 모두 타겟팅)
    const toRemove = clone.querySelectorAll('.no-print, .btn-send, .btn-neutral');
    toRemove.forEach(node => node.remove());

    // 인쇄 창 생성
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 700; }
            td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
            .total-row { font-weight: bold; background: #eee; }
            /* 사장님 요청에 따른 디자인 조정 */
            th:nth-child(2), td:nth-child(2),
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4) { text-align: right; }
            th:nth-child(1), td:nth-child(1) { text-align: left; }
        </style>
    </head>
    <body>
        ${clone.innerHTML}
    </body>
    </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 수신함 페이징 전역변수
let _hotelReceivedData = [];
let _hotelReceivedPage = 1;
const HOTEL_RECEIVED_PAGE_SIZE = 10;

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 수신함 (sent_logs 테이블 기반)
window.loadHotelReceivedInvoicesList = async function() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">불러오는 중...</td></tr>';

    const { data: logs, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, is_confirmed')
        .eq('hotel_id', currentHotelId)
        .order('sent_at', { ascending: false });

    if (error || !logs) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">오류: ${error?.message || '알 수 없는 오류'}</td></tr>`;
        renderHotelReceivedPaging(0);
        return;
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:gray;">수신된 정산 리포트가 없습니다.</td></tr>';
        renderHotelReceivedPaging(0);
        return;
    }

    _hotelReceivedData = logs;
    _hotelReceivedPage = 1;
    renderHotelReceivedPage();
};

function renderHotelReceivedPage() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if (!tbody) return;

    const total = _hotelReceivedData.length;
    const totalPages = Math.ceil(total / HOTEL_RECEIVED_PAGE_SIZE);
    const start = (_hotelReceivedPage - 1) * HOTEL_RECEIVED_PAGE_SIZE;
    const pageData = _hotelReceivedData.slice(start, start + HOTEL_RECEIVED_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(log => {
        const displayPeriod = log.period || '-';
        const confirmed = log.is_confirmed === true;
        const statusBadge = confirmed
            ? `<span class="badge" style="background:#16a34a; color:white; padding:2px 8px; border-radius:4px;">✅ 확인완료</span>`
            : `<span class="badge" style="background:var(--danger); color:white; padding:2px 8px; border-radius:4px;">🔴 수신완료</span>`;

        tbody.innerHTML += `<tr>
            <td style="text-align:left;">${displayPeriod}</td>
            <td style="text-align:right;">${Number(log.total_amount || 0).toLocaleString()}원</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:var(--primary); color:white; border:1px solid var(--primary); border-radius:4px; height:auto; display:inline-block;" onclick="viewHotelSentLogDetail('${log.id}')">상세</button>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:#16a34a; color:white; border:1px solid #16a34a; border-radius:4px; margin-left:4px; height:auto; display:inline-block;" onclick="downloadSentLogExcel('${log.id}', '${displayPeriod}')">Excel</button>
            </td>
        </tr>`;
    });

    renderHotelReceivedPaging(totalPages);
}

function renderHotelReceivedPaging(totalPages) {
    const paging = document.getElementById('hotelReceivedPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const total = _hotelReceivedData.length;
    const btnStyle = (active) => `padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${active?'700':'400'}; background:${active?'var(--primary)':'white'}; color:${active?'white':'#334155'}; min-width:36px; min-height:36px;`;

    // 이전 버튼
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _hotelReceivedPage === 1;
    prevBtn.style.opacity = _hotelReceivedPage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _hotelReceivedPage--; renderHotelReceivedPage(); };
    paging.appendChild(prevBtn);

    // 페이지 번호 (최대 5개)
    const maxShow = 5;
    let pageStart = Math.max(1, _hotelReceivedPage - Math.floor(maxShow / 2));
    let pageEnd = Math.min(totalPages, pageStart + maxShow - 1);
    if (pageEnd - pageStart < maxShow - 1) pageStart = Math.max(1, pageEnd - maxShow + 1);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _hotelReceivedPage);
        btn.onclick = ((p) => () => { _hotelReceivedPage = p; renderHotelReceivedPage(); })(i);
        paging.appendChild(btn);
    }

    // 다음 버튼
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _hotelReceivedPage === totalPages;
    nextBtn.style.opacity = _hotelReceivedPage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _hotelReceivedPage++; renderHotelReceivedPage(); };
    paging.appendChild(nextBtn);

    // 안내 텍스트
    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px; display:inline-block;';
    info.textContent = `총 ${total}건 / ${_hotelReceivedPage}페이지`;
    paging.appendChild(info);
}

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 상세보기 (sent_logs.id 기반)
window.viewHotelSentLogDetail = async function(logId) {
    const { data: log, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, hotel_id, is_confirmed, hotels(name)')
        .eq('id', logId)
        .single();

    if (error || !log) { alert('상세 정보를 불러올 수 없습니다.'); return; }

    await window.viewSentDetail(
        log.hotels?.name || '',
        log.period,
        log.id,
        true,
        log.hotel_id,
        log.is_confirmed
    );
};

// [v38] 거래처 파트너 - 정산확인 처리
window.confirmHotelSettlement = async function(logId) {
    if (!confirm('정산을 확인하시겠습니까?\n확인 후에는 변경할 수 없습니다.')) return;
    const { error } = await window.mySupabase
        .from('sent_logs')
        .update({ is_confirmed: true })
        .eq('id', logId);
    if (error) { alert('처리 중 오류가 발생했습니다: ' + error.message); return; }
    closeModal('sendInvoiceModal');
    window.loadHotelReceivedInvoicesList();
};

// [v38] 정산 리포트 Excel 다운로드 - ExcelJS 색상 스타일 적용
window.OLD_downloadSentLogExcel_0 = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    list.forEach(inv => (inv.invoice_items || []).forEach(it => {
        if (!it.name || it.name.trim() === '') return;
        if (!itemInfoMap[it.name]) itemInfoMap[it.name] = { price: Number(it.price||0) };
    }));

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    // ── 스타일 헬퍼 ──────────────────────────────────────────
    const C = {
        primary:  { argb: 'FF005B9F' }, // 진파랑
        accent:   { argb: 'FF00A8E8' }, // 하늘파랑
        header:   { argb: 'FFF1F5F9' }, // 연회색
        catBg:    { argb: 'FFE0F2FE' }, // 카테고리 하늘
        sumBg:    { argb: 'FFFEF3C7' }, // 수량합계 노랑
        amtBg:    { argb: 'FFE0F2FE' }, // 항목합계 파랑
        totalBg:  { argb: 'FFEFF6FF' }, // 최종합계 연파랑
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    const bold = { bold: true };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    // 빈 열 문제 방지를 위해 전체 뷰 초기화
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        // ── 특수거래처 ─────────────────────────────────────
        const itemCatMap = {}, orderedCats = [];
        (priceOrder || []).forEach(p => {
            itemCatMap[p.name] = p.category_name || '기타';
            if (!orderedCats.includes(p.category_name || '기타')) orderedCats.push(p.category_name || '기타');
        });
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemCatMap[name] || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = list.reduce((s, inv) =>
                s + (inv.invoice_items||[]).filter(it=>it.name===name).reduce((q,it)=>q+Number(it.qty||0),0), 0);
            if (totalQty > 0) {
                grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name]?.price || 0 });
            }
        });

        ws.columns = [{ width: 22 }, { width: 13 }, { width: 9 }, { width: 16 }];

        // 제목 행
        ws.mergeCells('A1:D1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= 4; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells('A2:D2');
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= 4; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            // 카테고리 헤더
            ws.mergeCells(`A${rowNum}:D${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            // 병합된 나머지 셀에도 테두리를 명시적으로 적용 (빈 열 파생 방지)
            for (let i = 2; i <= 4; i++) {
                ws.getCell(rowNum, i).border = border;
            }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            // 컬럼 헤더
            ['품목', '단가(원)', '수량', '금액(원)'].forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = [it.name, it.price, it.qty, it.price * it.qty];
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 ? '#,##0' : undefined });
                });
                rowNum++;
            });
            rowNum++; // 빈 행
        });

        // 공급가 / 부가세 / 총합계 행
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border; // 병합 셀 테두리 보강

        ws.mergeCells(`C${rowNum}:D${rowNum}`);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };
        ws.getCell(`D${rowNum}`).border = border; // 병합 셀 테두리 보강

        rowNum++;
        ws.mergeCells(`A${rowNum}:D${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= 4; i++) {
            ws.getCell(rowNum, i).border = border;
        }
        ws.getRow(rowNum).height = 24;

        // 불필요한 빈 열 방지를 위해 인쇄 영역 명시적 지정
        ws.pageSetup.printArea = `A1:D${rowNum}`;

    } else {
        // ── 일반거래처: 날짜 × 품목 매트릭스 ──────────────
        const orderedNames = (priceOrder||[]).map(p=>p.name).filter(n=>itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n=>!orderedNames.includes(n));
        const allItems = [...orderedNames, ...extraNames];

        const allDates = [];
        for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1))
            allDates.push(d.toISOString().split('T')[0]);

        const matrix = {};
        allDates.forEach(d => { matrix[d] = {}; allItems.forEach(n => matrix[d][n] = 0); });
        list.forEach(inv => (inv.invoice_items||[]).forEach(it => {
            if (matrix[inv.date]) matrix[inv.date][it.name] = (matrix[inv.date][it.name]||0) + Number(it.qty||0);
        }));

        const qtyTotals = {}, priceTotals = {};
        allItems.forEach(n => {
            qtyTotals[n] = allDates.reduce((s,d) => s+(matrix[d][n]||0), 0);
            priceTotals[n] = qtyTotals[n] * (itemInfoMap[n]?.price||0);
        });

        // 컬럼 너비
        ws.columns = [{ width: 10 }, ...allItems.map(() => ({ width: 10 }))];

        // 제목
        const titleEnd = String.fromCharCode(65 + allItems.length);
        ws.mergeCells(`A1:${titleEnd}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${titleEnd}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'center' });

        // 헤더 행 (일자 + 품목들)
        const hRow = ws.getRow(3);
        ['일자', ...allItems].forEach((v, i) => {
            const c = hRow.getCell(i + 1);
            c.value = v;
            styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
        });
        ws.getRow(3).height = 18;

        // 날짜별 데이터 행
        allDates.forEach((d, idx) => {
            const row = ws.getRow(4 + idx);
            const dayLabel = d.slice(8) + '일';
            [dayLabel, ...allItems.map(n => matrix[d][n] || 0)].forEach((v, i) => {
                const c = row.getCell(i + 1);
                c.value = v;
                const isZero = i > 0 && v === 0;
                styleCell(c, { align: 'center', fontColor: isZero ? { argb: 'FFCBD5E1' } : C.dark });
            });
        });

        const baseRow = 4 + allDates.length;

        // 수량 합계 행
        const qRow = ws.getRow(baseRow);
        ['수량 합계', ...allItems.map(n => qtyTotals[n])].forEach((v, i) => {
            const c = qRow.getCell(i + 1);
            c.value = v;
            styleCell(c, { bg: C.sumBg, isBold: true, align: 'center' });
        });
        ws.getRow(baseRow).height = 18;

        // 단가 행
        const prRow = ws.getRow(baseRow + 1);
        ['단가(원)', ...allItems.map(n => itemInfoMap[n]?.price||0)].forEach((v, i) => {
            const c = prRow.getCell(i + 1);
            c.value = v;
            styleCell(c, { bg: C.header, isBold: i === 0, align: 'center', numFmt: i > 0 ? '#,##0' : undefined });
        });

        // 항목 합계 행
        const amtRow = ws.getRow(baseRow + 2);
        ['항목 합계(원)', ...allItems.map(n => priceTotals[n])].forEach((v, i) => {
            const c = amtRow.getCell(i + 1);
            c.value = v;
            styleCell(c, { bg: C.amtBg, isBold: true, fontColor: C.primary, align: 'center', numFmt: i > 0 ? '#,##0' : undefined });
        });
        ws.getRow(baseRow + 2).height = 18;

        // 공급가 / 부가세 / 총합계 (셀 병합)
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        const colCount = allItems.length + 1; // 일자 + 품목 수
        const lastCol = String.fromCharCode(64 + colCount);
        const midCol  = String.fromCharCode(64 + Math.ceil(colCount / 2));
        const midCol2 = String.fromCharCode(64 + Math.ceil(colCount / 2) + 1);

        // 공급가 (왼쪽 절반 병합)
        const r1 = baseRow + 4;
        ws.mergeCells(`A${r1}:${midCol}${r1}`);
        const sc = ws.getCell(`A${r1}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getRow(r1).height = 22;

        // 부가세 (오른쪽 절반 병합)
        ws.mergeCells(`${midCol2}${r1}:${lastCol}${r1}`);
        const vc = ws.getCell(`${midCol2}${r1}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        // 총 합계 (전체 열 병합)
        const r2 = r1 + 1;
        ws.mergeCells(`A${r2}:${lastCol}${r2}`);
        const tc = ws.getCell(`A${r2}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(r2).height = 26;
        
        ws.pageSetup.printArea = `A1:${lastCol}${r2}`;
    }

    // 파일 저장
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safePeriod = displayPeriod.replace(/[\/\\:*?"<>|]/g, '_');
    a.href = url;
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

window.confirmSendInvoice = async function(sDate, eDate, hotelId, totalAmount, supplyPrice, vat) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const f = platformData.factories[currentFactoryId];
    if (f && f.history) {
        f.history.forEach(inv => {
            if (inv.hotelId === hotelId && inv.date >= sDate && inv.date <= eDate) {
                inv.isSent = true;
                inv.reportPeriod = sDate + ' ~ ' + eDate;
            }
        });

        if(!f.sentInvoices) f.sentInvoices = [];
        const h = f.hotels[hotelId];

        // [v34 기존 방식] sentInvoices JSON Blob에 기록
        f.sentInvoices.push({
            sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            hotelName: h ? h.name : '알수없음',
            hotelId: hotelId,
            period: sDate + ' ~ ' + eDate,
            totalAmount: totalAmount,
            supplyPrice: supplyPrice,
            vat: vat
        });

        await saveData(); // [v37 수정] Supabase JSON blob에 저장
        alert('성공적으로 발송되었습니다.');
        closeModal('sendInvoiceModal');
        loadAdminDashboard();
        window.loadAdminSentList();
    }
};


window.togglePlatformDropdown = function() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

window.login = async function() {
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    if(!roleEl || !idEl || !pwEl) return;

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const password = pwEl.value.trim();

    if (role === '선택하세요' || !role) { alert('역할을 선택해주세요.'); return; }
    if (!lId || !password) { alert('ID와 비밀번호를 입력해주세요.'); return; }

    // 슈퍼어드민 계정 확인 (SQL-First DB 연동)
    if (role === 'superadmin') {
        const { data: settings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
        
        let superAdminId = 'admin'; // 기본값 (테이블이 비어있을 경우 대비)
        let superAdminPw = '1111';  // 기본값
        
        if (settings && settings.admin_id) {
            superAdminId = settings.admin_id;
            superAdminPw = settings.admin_pw;
        }
        
        if (lId === superAdminId && password === superAdminPw) {
            showView('superAdminView', '플랫폼 총괄 관리자');
            window.loadSuperAdminDashboard();
            if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
            return;
        } else {
            alert('슈퍼관리자 ID 또는 비밀번호가 일치하지 않습니다.');
            return;
        }
    }

    document.getElementById('loginDebugArea').style.display = 'block';
    document.getElementById('loginDebugArea').innerText = 'DB 확인 중...';

    // 1. 세탁공장 대표 로그인 (factories 테이블 검색)
    if (role === 'admin') {
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.admin_pw !== password) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }
        if (data.status === 'pending') { alert('가입 승인 대기 중입니다. 플랫폼 관리자의 승인을 기다려주세요.'); return; }
        if (data.status === 'suspended') { alert('미운영 상태입니다. 관리자에게 문의하세요.'); return; }

        currentFactoryId = data.id;
        localStorage.setItem('currentFactoryId', data.id);
        
        // [만료일 체크 및 구독 상태 자동 업데이트]
        if (data.plan_expiry) {
            const expiry = new Date(data.plan_expiry);
            expiry.setHours(23, 59, 59, 999); // 만료일 당일까지는 만료되지 않은 것으로 처리
            const today = new Date();
            
            let newSubStatus = data.sub_status;
            
            if (expiry < today) {
                newSubStatus = 'expired';
            } else if (expiry - today < 15 * 24 * 60 * 60 * 1000) { // 15일 이내
                newSubStatus = 'expiring';
            } else {
                // 15일 이상 넉넉하게 남았을 때
                // 만약 현재 상태가 '무료체험(trial)'이라면 'active'로 덮어쓰지 않고 유지합니다.
                if (data.sub_status !== 'trial') {
                    newSubStatus = 'active';
                }
            }
            
            // DB 업데이트 수행
            if (newSubStatus !== data.sub_status) {
                await window.mySupabase.from('factories').update({ sub_status: newSubStatus }).eq('id', data.id);
                data.sub_status = newSubStatus; // 현재 객체 상태도 업데이트
                console.log(`[로그인 시점 업데이트] 구독상태가 ${newSubStatus} 로 변경되었습니다.`);
            }
            
            // 결제 유도 팝업 띄우기 (만료됨 또는 만료 임박)
            if (data.sub_status === 'expired' || data.sub_status === 'expiring') {
                if (data.sub_status !== 'trial') {
                    const msg = data.sub_status === 'expired' ? "요금제 기간이 만료되었습니다. 결제 후 계속 이용해 주세요." : "요금제 만료가 임박했습니다. 미리 결제해 주세요.";
                    document.getElementById('paymentMsg').innerText = msg;
                    openModal('paymentModal');
                    window.loadAdminPayment(); // 요금제 정보 로드
                }
            }
        }
        
        // 기존 호환성용 껍데기 세팅
        if (!platformData.factories[data.id]) platformData.factories[data.id] = { hotels: {}, staffAccounts: {}, history: [] };
        
        showView('adminView', data.name + ' - 대표');
        window.loadAdminDashboard();
        return;
    }
    
    // 2. 현장 직원 로그인 (staff 테이블 검색)
    if (role === 'staff') {
        // staff 테이블과 연결된 factories 테이블의 이름까지 조인해서 한 번에 가져옴!
        const { data, error } = await window.mySupabase
            .from('staff')
            .select('*, factories(name)')
            .eq('login_id', lId)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.login_pw !== password) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentStaffName = data.name; localStorage.setItem('staffName', data.name); localStorage.setItem('currentStaffName', data.name);
        localStorage.setItem('currentFactoryId', data.factory_id);

        showView('staffView', (data.factories ? data.factories.name : '세탁공장') + ' - 현장직원 (' + currentStaffName + ')');
        
        // v34 전용 함수 (나중에 구현)
        if(typeof window.loadStaffHotelSelect === 'function') window.loadStaffHotelSelect();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        return;
    }

    // 3. 거래처 파트너 로그인 (hotels 테이블 검색)
    if (role === 'hotel') {
        const { data, error } = await window.mySupabase
            .from('hotels')
            .select('*, factories(name, phone, ceo)')
            .eq('login_id', lId)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.login_pw !== password) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

        currentFactoryId = data.factory_id;
        currentHotelId = data.id;
        localStorage.setItem('currentFactoryId', data.factory_id);
        localStorage.setItem('currentHotelId', data.id);

        // 호환성 껍데기
        if (!platformData.factories[data.factory_id]) platformData.factories[data.factory_id] = { hotels: {}, staffAccounts: {}, history: [] };
        if (!platformData.factories[data.factory_id].hotels[data.id]) platformData.factories[data.factory_id].hotels[data.id] = { name: data.name };

        showView('hotelView', (data.factories ? data.factories.name : '세탁공장') + ' 파트너 대시보드');
        window.loadHotelDashboard();
        return;
    }
};

// [v34 버그픽스] 현장 직원 화면 - 거래처 셀렉트 박스 불러오기 (Hotels 테이블 연동)
window.loadStaffHotelSelect = async function() {
    const sel = document.getElementById('staffHotelSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- 거래처 불러오는 중... --</option>';

    // 현재 공장에 등록된 모든 거래처(Hotels)를 DB에서 긁어옵니다
    const { data, error } = await window.mySupabase
        .from('hotels')
        .select('id, name')
        .eq('factory_id', currentFactoryId)
        .order('name');

    if (error || !data || data.length === 0) {
        sel.innerHTML = '<option value="">-- 등록된 거래처 없음 --</option>';
        return;
    }

    // 가나다순 / ABC순 완벽 정렬 보장 (Javascript localeCompare)
    data.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    sel.innerHTML = '<option value="">-- 거래처 선택 --</option>';
    data.forEach(h => {
        sel.innerHTML += `<option value="${h.id}">${h.name}</option>`;
    });
};

// [v38 SQL-First] 이전 레거시 openInvoiceModal 제거됨 - 아래 최신 DB 버전 사용

// [v34 버그픽스] Enter 키 엔터로 아래 칸 이동 및 단가표 그리기 수정
window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if (!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    // 거래처 정보
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    // 같은 날짜 기존 명세서 조회 (수정 모드 판별)
    const { data: existingInv } = await window.mySupabase
        .from('invoices')
        .select('id')
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    const isEditMode = !!existingInv;

    // 수정 모드 배지
    const badge = document.getElementById('editModeBadge');
    if (badge) {
        badge.style.display = isEditMode ? 'block' : 'none';
        badge.innerText = isEditMode ? '✏️ 수정 모드 — 기존 명세서를 불러왔습니다.' : '';
    }

    // 기존 수량 맵 (품목명 → qty)
    const savedQtyMap = {};
    if (isEditMode) {
        const { data: existingItems } = await window.mySupabase
            .from('invoice_items')
            .select('name, qty')
            .eq('invoice_id', existingInv.id);
            
        if (existingItems) {
            existingItems.forEach(it => { savedQtyMap[it.name] = Number(it.qty || 0); });
        }
    }

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    // hotel_item_prices 테이블에서 단가 목록 (sort_order 순)
    const { data: priceItems } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit, category_name')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (!priceItems || priceItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--secondary);">등록된 품목이 없습니다. 단가 설정을 먼저 해주세요.</td></tr>';
        return;
    }

    const isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';

    const makeRow = (item) => {
        const unit = item.unit || '개';
        const qty = savedQtyMap[item.name] || 0;
        return `
        <tr>
            <td>${item.name}</td>
            <td>${unit}</td>
            <td class="item-price">${item.price}</td>
            <td><input type="number" class="inv-qty qty-input" value="${qty}" 
                onfocus="if(this.value==='0') this.value=''; else { var t=this; setTimeout(function(){t.select();}, 10); }" 
                onblur="if(this.value==='') this.value='0';"
                oninput="calcTotal()" onkeydown="handleQtyKeydown(event)"
                style="width:60px; padding:3px; text-align:center;"></td>
            <td class="item-amount">0원</td>
        </tr>`;
    };

    if (isSpecial) {
        const grouped = {}, catOrder = [];
        priceItems.forEach(item => {
            const cat = item.category_name || '기타';
            if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
            grouped[cat].push(item);
        });
        catOrder.forEach(cat => {
            tbody.innerHTML += `<tr style="background:#f1f5f9;"><td colspan="5" style="font-weight:700; padding:6px 8px; border-bottom:1px solid #cbd5e1;">📂 ${cat}</td></tr>`;
            grouped[cat].forEach(item => { tbody.innerHTML += makeRow(item); });
        });
    } else {
        priceItems.forEach(item => { tbody.innerHTML += makeRow(item); });
    }

    if (typeof window.calcTotal === 'function') window.calcTotal();
};

window.calcTotal = function() {
    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    let total = 0;
    rows.forEach(row => {
        if(row.cells.length < 5) return;
        const price = Number(row.cells[2].innerText.replace(/[^0-9-]/g, '')) || 0;
        const qtyInput = row.querySelector('.qty-input');
        const qty = qtyInput ? Number(qtyInput.value) : 0;
        const amt = price * qty;
        total += amt;
        row.querySelector('.item-amount').innerText = amt.toLocaleString() + '원';
    });
    document.getElementById('invoiceTotalAmount').innerText = total.toLocaleString() + '원';
};

// [v34 버그픽스] 현장직원 화면 - 거래명세서 발행 목록 (Invoices & Hotels 조인)
// [v38 페이징] 현장직원 발행 목록 페이징 상태
let _staffInvoiceAllData = [];
let _staffInvoicePage = 1;
const STAFF_INVOICE_PAGE_SIZE = 50;

window.OLD_loadStaffInvoiceList_0 = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    let query = window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            _isInvoiceLoading = false;
            return;
        }

        tbody.innerHTML = '';
        filteredData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
};

window.loadAdminStaffList = async function() {
    const tbody = document.getElementById('adminStaffList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">직원 목록을 불러오는 중...</td></tr>';

    const { data: staffList, error: sErr } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(sErr) { tbody.innerHTML = `<tr><td colspan="3" style="color:red;">에러: ${sErr.message}</td></tr>`; }
    else if(!staffList || staffList.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">등록된 직원이 없습니다.</td></tr>'; }
    else {
        tbody.innerHTML = '';
        staffList.forEach(s => {
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td style="font-size:13px;">${s.login_id}<br><small style="color:var(--secondary)">PW: ${s.login_pw}</small></td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td>
            </tr>`;
        });
    }

    // Load recent invoices (직원/발행 화면 하단 발행 현황 목록)
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;
    
    // pagination for staff activity list
    const itemsPerPage = 10;
    window.currentStaffPage = window.currentStaffPage || 1;
    const startIdx = (window.currentStaffPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage - 1;

    // [수정] 관리자(차감) 명세서는 직원 발행 현황에서도 보이지 않도록 필터링
    const { data: invoices, error: iErr, count } = await window.mySupabase.from('invoices')
        .select('*, hotels(name)', { count: 'exact' })
        .eq('factory_id', currentFactoryId)
        .order('created_at', { ascending: false })
        .range(startIdx, endIdx);

    if(iErr) { activityBody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${iErr.message}</td></tr>`; }
    else {
        const filteredInvoices = invoices ? invoices.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        if(filteredInvoices.length === 0) {
            activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>';
        } else {
            activityBody.innerHTML = '';
            filteredInvoices.forEach(inv => {
            const displaySum = inv.total_amount || 0;
            const hName = (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음';
            activityBody.innerHTML += `<tr>
                <td style="font-size:12px;">${inv.date}</td>
                <td>${inv.staff_name || '직원'}</td>
                <td><strong>${hName}</strong></td>
                <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
            </tr>`;
        });
        
        // (페이징 버튼 렌더링 로직 유지)
        const paginationDiv = document.getElementById('adminStaffPagination');
        if(paginationDiv && count) {
            const totalPages = Math.ceil(count / itemsPerPage);
            let pageHtml = '<div style="margin-top:10px; text-align:center;">';
            for (let i = 1; i <= totalPages; i++) {
                if (i === window.currentStaffPage) {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:var(--primary); color:white; border:none; border-radius:4px;">${i}</button>`;
                } else {
                    pageHtml += `<button style="margin:2px; padding:4px 8px; font-size:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;" onclick="window.currentStaffPage=${i}; window.loadAdminStaffList()">${i}</button>`;
                }
            }
            pageHtml += '</div>';
            paginationDiv.innerHTML = pageHtml;
        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
};

// 전역 변수로 현재 팝업의 차감 내역을 인메모리로 관리
window._currentDeductions = [];

window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="text" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { 
                            event.preventDefault(); 
                            const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); 
                            const idx = inputs.indexOf(this); 
                            if(idx > -1 && idx < inputs.length - 1) {
                                inputs[idx+1].focus(); 
                            } else {
                                document.getElementById('btnSaveDeduction').focus();
                            }
                        }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.OLD_saveDeduction_7 = function() {
    const hId = document.getElementById('deductHotelId').value;
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

    // 인메모리에 저장
    window._currentDeductions = itemsToDeduct;

    closeModal('deductionModal');
    
    // 발송 팝업 리렌더링 (DB 저장 없이 화면만 갱신)
    if (typeof window.sendInvoicesToClient === 'function') {
        window._isReRenderingPopup = true;
        window.sendInvoicesToClient(); 
    }
};

window.OLD_sendInvoicesToClient_13 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    // 사용자가 새롭게 발송 버튼을 누른 경우(리렌더링이 아닌 경우) 메모리 초기화
    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    // 1. DB의 진짜 배송 데이터만 로드 (과거의 '관리자(차감)' 명세서는 철저히 무시)
    list.forEach(inv => {
        if ((inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) return; // 완전 무시
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                // 현장 직원이 입력한 일반 마이너스
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    // 2. 현재 메모리에 있는 차감 내역을 가상으로 병합 (화면 표시용)
    const deductionDate = eDate; // 마지막 날짜에 차감 귀속
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    // [핵심 변경] 발송하기 버튼을 눌렀을 때만 DB에 기록 적용!
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // 1. 기존 동일 기간/거래처의 과거 차감 내역은 삭제 (항상 새롭게 발송하는 개념)
            await window.mySupabase.from('invoices')
                .delete()
                .eq('factory_id', currentFactoryId)
                .eq('hotel_id', hotelFilter)
                .eq('staff_name', '관리자(차감)')
                .gte('date', sDate)
                .lte('date', eDate);

            // 2. 현재 메모리에 차감이 있다면 DB에 새로운 차감 명세서 생성
            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_deduct';
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, // 종료일에 귀속
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true // 발송과 동시에 처리됨
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }

            // 3. 발송 로그 생성
            const logs = list.map(inv => ({
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                period_start: sDate,
                period_end: eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            }));
            await window.mySupabase.from('sent_logs').insert([logs[0]]);
            
            // 4. 일반 명세서들의 is_sent 처리
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            // 5. 카카오톡 발송 호출 (UI 호환성을 위해 try-catch 처리)
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};

window.OLD_sendInvoicesToClient_14 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    list.forEach(inv => {
        if ((inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) return; 
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const deductionDate = eDate; 
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까?`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            // [버그 수정] DB 스키마에 맞춰서 period 필드만 사용. (period_start, period_end 제거)
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    author: '관리자(차감)',
                    is_sent: true, 
                    memo: 'sent_log_id:' + newLog.id 
                }]);
                
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    openModal('sendInvoiceModal');
};

// 1. 발송 팝업 수정본은 그대로 두고, 2. 내역확인 팝업만 다시 재정의 (맨 끝에 한 번만 실행되게 덮어쓰기)
window.OLD_viewSentDetail_1 = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // 과거 내역을 불러올 때는, 그 발송 건(sentLogId)에 귀속된 '차감 전용 명세서'도 반드시 함께 불러와야 합니다!
    const { data: invData, error: invErr } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name, memo')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });
        
    if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

    const list = invData || [];

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // 1. 일반 명세서(staff_name이 관리자(차감)이 아닌 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (!(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) return true;
        // 이 차감 명세서가 현재 열어보는 발송 로그(sentLogId)를 위해 만들어졌는가?
        return inv.memo === 'sent_log_id:' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

window.OLD_viewSentDetail_2 = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [핵심 변경] DB에 존재하지 않는 memo 컬럼 조회 제거!
    const { data: invData, error: invErr } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit), staff_name')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });
        
    if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

    const list = invData || [];

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // 1. 일반 명세서(staff_name이 '관리자(차감)_'로 시작하지 않는 것)는 무조건 포함
    // 2. 관리자(차감) 명세서 중에서는, 오직 '내가 열어본 발송 내역(sentLogId)'과 매칭되는 녀석만 선별해서 포함!!
    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
        return inv.staff_name === '관리자(차감)_' + sentLogId; 
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

window.OLD_downloadSentLogExcel_1 = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    // ── 스타일 헬퍼 ──────────────────────────────────────────
    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        // ── 특수거래처 ─────────────────────────────────────
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        // 컬럼
        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        // 제목 행
        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            // 카테고리 헤더
            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            // 컬럼 헤더
            const headers = globalHasDeduction ? ['품목', '단가(원)', '차감', '수량(순)', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.negQty !== 0 ? it.negQty : '0', it.netQty, it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 2 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; // 빈 행
        });

        // 공급가 / 부가세 / 총합계 행
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        // ── 일반거래처: 날짜 × 품목 매트릭스 ──────────────
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        // 제목
        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        // 기간
        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        // 헤더
        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                c.value = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                styleCell(c, { numFmt: '#,##0' });
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        // 총계 하단 안내
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

// 1. 발송 팝업 수정
window.OLD_sendInvoicesToClient_15 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            // [핵심 로직 수정] '(차감)' 꼬리표가 붙은 항목만 월말 차감으로 분류!
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                // 일반 일일 명세서의 마이너스(-) 및 플러스(+) 수량은 모두 날짜별 데이터로 유지!
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0); // 일반 마이너스도 여기 포함
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                // 일반 명세서의 마이너스 수량은 빨간색으로 표시
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.OLD_viewSentDetail_3 = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정
window.OLD_downloadSentLogExcel_2 = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '차감', '수량(순)', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.negQty !== 0 ? it.negQty : '0', it.netQty, it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 2 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red; // 일반 마이너스는 빨간색
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

// 1. 발송 팝업 수정
window.OLD_sendInvoicesToClient_16 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.OLD_viewSentDetail_4 = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(순)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정
window.OLD_downloadSentLogExcel_3 = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(순)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red; // i===3 이 차감
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

// 1. 발송 팝업 수정
window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    openModal('sendInvoiceModal');
};

// 2. 내역확인 팝업 수정
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    const { data: invData } = await window.mySupabase
        .from('invoices')
        .select('id, date, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelId)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    const list = invData || [];

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceData && priceData.length > 0) {
        const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceData.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.netQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
                <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
                <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                    <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
            </div>
        `;

    } else {
        reportHtml = `
            <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    openModal('sendInvoiceModal');
};

// 3. 엑셀 다운로드 수정
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.netQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

window.OLD_loadStaffInvoiceList_1 = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    // [수정] author 가 '관리자(차감)'인 내역은 현장 직원 화면에 노출하지 않음
    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, author, hotels ( name )`)
        .eq('factory_id', currentFactoryId)
        .neq('author', '관리자(차감)');

    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        renderStaffInvoicePaging(0);
        return;
    }

    if (data.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        renderStaffInvoicePaging(0);
        return;
    }

    _staffInvoiceAllData = data;
    _staffInvoicePage = 1;
    if (typeof renderStaffInvoicePage === 'function') renderStaffInvoicePage();
};

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

window.OLD_loadStaffInvoiceList_2 = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    // [수정] staff_name이 '관리자(차감)'인 내역은 현장 직원 화면에 아예 노출하지 않음
    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', currentFactoryId)
        .not('staff_name', 'like', '관리자(차감)%');

    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    if (data.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    window._staffInvoiceAllData = data;
    window._staffInvoicePage = 1;
    
    if (typeof window.renderStaffInvoicePage === 'function') {
        window.renderStaffInvoicePage();
    } else {
        console.error("renderStaffInvoicePage is missing");
    }
};

window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', currentFactoryId);

    // [수정] .neq() 쿼리에서 발생하는 에러일 수 있으므로, 서버 쿼리는 전체를 가져오고 프론트에서 필터링
    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 프론트엔드에서 '관리자(차감)' 데이터를 걸러냄 (DB 구조나 버전에 구애받지 않는 가장 안전한 방식)
    const filteredData = data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));

    if (filteredData.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 전역 변수에 데이터 저장 후 페이징 렌더 함수 호출
    // 레거시 코드와 완벽 호환되도록 전역 객체명 원복
    window._staffInvoiceAllData = filteredData;
    window._staffInvoicePage = 1;
    
    if (typeof window.renderStaffInvoicePage === 'function') {
        window.renderStaffInvoicePage();
    } else if (typeof renderStaffInvoicePage === 'function') {
        renderStaffInvoicePage();
    } else {
        console.error("renderStaffInvoicePage 함수가 없습니다.");
    }
};
