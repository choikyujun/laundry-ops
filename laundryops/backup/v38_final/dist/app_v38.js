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

window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
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

window.sendInvoicesToClient = function() {
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
    else if(!invoices || invoices.length === 0) { activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>'; }
    else {
        activityBody.innerHTML = '';
        invoices.forEach(inv => {
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
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).eq('admin_pw', password).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }
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
                newSubStatus = 'active';
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
            .eq('login_pw', password)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

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
            .eq('login_pw', password)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data) { alert('ID 또는 비밀번호가 일치하지 않습니다.'); return; }

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
    renderStaffInvoicePage();
};

function renderStaffInvoicePage() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if (!tbody) return;

    const total = _staffInvoiceAllData.length;
    const totalPages = Math.ceil(total / STAFF_INVOICE_PAGE_SIZE);
    const start = (_staffInvoicePage - 1) * STAFF_INVOICE_PAGE_SIZE;
    const pageData = _staffInvoiceAllData.slice(start, start + STAFF_INVOICE_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
        const statusBadge = inv.is_sent
            ? '<span class="badge" style="background:var(--success);">발송완료</span>'
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';
        tbody.innerHTML += `
        <tr>
            <td>${inv.date}</td>
            <td style="font-weight:700;">${hName}</td>
            <td style="text-align:right;">${Number(inv.total_amount || 0).toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td>${inv.staff_name || '관리자'}</td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
        </tr>`;
    });

    renderStaffInvoicePaging(totalPages);
}

function renderStaffInvoicePaging(totalPages) {
    const paging = document.getElementById('staffInvoicePaging');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const total = _staffInvoiceAllData.length;
    const btnStyle = (active) => `padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${active?'700':'400'}; background:${active?'var(--primary)':'white'}; color:${active?'white':'#334155'};`;

    // 이전 버튼
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _staffInvoicePage === 1;
    prevBtn.style.opacity = _staffInvoicePage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _staffInvoicePage--; renderStaffInvoicePage(); };
    paging.appendChild(prevBtn);

    // 페이지 번호 버튼 (최대 5개 표시)
    const maxShow = 5;
    let pageStart = Math.max(1, _staffInvoicePage - Math.floor(maxShow / 2));
    let pageEnd = Math.min(totalPages, pageStart + maxShow - 1);
    if (pageEnd - pageStart < maxShow - 1) pageStart = Math.max(1, pageEnd - maxShow + 1);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _staffInvoicePage);
        btn.onclick = ((p) => () => { _staffInvoicePage = p; renderStaffInvoicePage(); })(i);
        paging.appendChild(btn);
    }

    // 다음 버튼
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _staffInvoicePage === totalPages;
    nextBtn.style.opacity = _staffInvoicePage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _staffInvoicePage++; renderStaffInvoicePage(); };
    paging.appendChild(nextBtn);

    // 총 건수 표시
    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px;';
    info.textContent = `총 ${total}건 / ${_staffInvoicePage}페이지 (${totalPages}페이지)`;
    paging.appendChild(info);
}


// [v38 SQL-First] 하단 중복 switchTab 제거됨

// [v34 버그픽스] 대표자 화면 - 첫 번째 탭의 거래명세서 목록 (필터링 및 UI 렌더링 완벽 복구)
// 중복을 제거하기 위해 이 곳에 있던 loadAdminDashboard 오버라이드 삭제

// [v38 SQL-First] 중복 switchTab 제거됨

// [v34 버그픽스] 필터(호텔/날짜) 변경 시 목록 갱신
window.handleAdminFilterChange = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (hotelFilter && hotelFilter.value === 'all') {
        document.getElementById('adminStatsStartDate').value = '';
        document.getElementById('adminStatsEndDate').value = '';
    }
    // 필터 변경 시 목록 다시 로드!
    window.loadAdminRecentInvoices();
};

window.onloadAdminRecentInvoicesProxy = async function() {
    await window.loadAdminRecentInvoices();
};

// HTML에서 onchange="loadAdminRecentInvoices()" 로 되어있는 부분 연결
const dateInputs = ['adminStatsStartDate', 'adminStatsEndDate'];
dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.onchange = window.onloadAdminRecentInvoicesProxy;
    }
});


// [v34 버그픽스] 로그인 시 즉시 대표 화면 데이터 렌더링 강제화
/* removed dummy */
// [v34 버그픽스] 필터 값 가져오는 방어 코드 강화 (HTML 요소가 아직 로드 안됐을 때 에러 방지)
window.loadAdminRecentInvoices = async function(returnList = false) {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { console.log('DEBUG: tbody not found'); return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const sDateEl = document.getElementById('adminStatsStartDate');
    const eDateEl = document.getElementById('adminStatsEndDate');
    const hotelFilterEl = document.getElementById('adminStatsHotelFilter');

    const sDate = sDateEl ? sDateEl.value : '';
    const eDate = eDateEl ? eDateEl.value : '';
    const hotelFilter = hotelFilterEl ? hotelFilterEl.value : 'all';

    let query = window.mySupabase
        .from('invoices')
        .select(`
            id, date, total_amount, is_sent, staff_name, hotel_id,
            hotels ( name, contract_type )
        `)
        .eq('factory_id', currentFactoryId);

    if (sDate) query = query.gte('date', sDate);
    if (eDate) query = query.lte('date', eDate);
    if (hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

    const { data, error } = await query.order('date', { ascending: false }).limit(100);

    if (error || !data) {
        console.error('명세서 로드 실패:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중 오류가 발생했습니다.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
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
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

// [v34 버그픽스] 로그인/새로고침 즉시 목록 강제 로드 (HTML에 박혀있는 onload 이벤트 대체)
const _originalShowView = window.showView;
window.showView = async function(id, title) {
    if(typeof _originalShowView === 'function') {
        _originalShowView(id, title);
    }
    
    // 이 부분에서 loadAdminRecentInvoices 를 또 호출하면 
    // loadAdminDashboard 내부 호출과 겹쳐서 중복 렌더링이 발생하므로 삭제합니다.
};


// [v34 강제 버그픽스] 대표자 화면 명세서 로드 시 오류 로그 출력용
window.loadAdminRecentInvoices = async function(returnList = false) {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { console.log('DEBUG: tbody adminRecentInvoiceList not found'); return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const sDateEl = document.getElementById('adminStatsStartDate');
    const eDateEl = document.getElementById('adminStatsEndDate');
    const hotelFilterEl = document.getElementById('adminStatsHotelFilter');

    const sDate = sDateEl ? sDateEl.value : '';
    const eDate = eDateEl ? eDateEl.value : '';
    const hotelFilter = hotelFilterEl ? hotelFilterEl.value : 'all';

    console.log("DEBUG: loadAdminRecentInvoices Filter ->", sDate, eDate, hotelFilter, "FactoryID:", currentFactoryId);

    let query = window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);

    if (sDate) query = query.gte('date', sDate);
    if (eDate) query = query.lte('date', eDate);
    if (hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

    const { data, error } = await query.order('date', { ascending: false }).limit(100);

    console.log("DEBUG: loadAdminRecentInvoices Data ->", data, "Error ->", error);

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">오류 발생: ${error?.message || '알 수 없음'}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">조건에 맞는 작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
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
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button></td>
        </tr>`;
    });
};

// [v34 찐막 버그픽스] loadAdminRecentInvoices 쿼리 수정 (Join 때문에 데이터가 날아가는 현상 수정)
window.loadAdminRecentInvoices = async function(returnList = false) {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
    const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
    const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

    console.log("DEBUG: Final Query Start. FactoryID:", currentFactoryId);

    // Supabase에서 Left Join (hotels 테이블 정보가 없어도 invoices는 나오도록 보장)
    let query = window.mySupabase
        .from('invoices')
        // 중요: 외래키 관계가 꼬였을 때를 대비해 inner join이 아닌 left join을 유도합니다.
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);

    if (sDate) query = query.gte('date', sDate);
    if (eDate) query = query.lte('date', eDate);
    if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

    const { data, error } = await query.order('date', { ascending: false }).limit(100);

    if (error) {
        console.error("DEBUG: Supabase Error ->", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
        return;
    }

    console.log("DEBUG: Final Query Data ->", data);

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
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
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button></td>
        </tr>`;
    });
};

// ==========================================
// [v34] Step 5: 플랫폼 마스터 대시보드 (RDBMS 통계)
// ==========================================
// [v38] 플랫폼 총괄 관리자 - 공장 관리 페이징 전역변수
let _superFactoryData = [];
let _superFactoryMap = {};
let _superFactoryPage = 1;
const SUPER_FACTORY_PAGE_SIZE = 20;

// [v38] 플랫폼 총괄 관리자 - 결제 승인 내역 페이징 전역변수
let _approvedPaymentData = [];
let _approvedPaymentMap = {};
let _approvedPaymentPage = 1;
const APPROVED_PAYMENT_PAGE_SIZE = 10;

window.loadSuperAdminDashboard = async function() {
    const tbody = document.getElementById('superFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    window.loadPendingFactories();
    if(typeof window.loadPendingPayments === 'function') await window.loadPendingPayments();
    if(typeof window.loadApprovedPaymentsPage === 'function') window.loadApprovedPaymentsPage();

    const curMonth = document.getElementById('superStatsMonth')?.value || getTodayString().substring(0, 7);
    const searchQuery = document.getElementById('searchFactoryInput')?.value.toLowerCase() || '';

    // 전체 공장 불러와서 클라이언트 검색/페이징 적용
    const { data: factories, error: fErr } = await window.mySupabase.from('factories').select('*').order('created_at', { ascending: false });

    if (fErr) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${fErr.message}</td></tr>`; return; }
    if (!factories || factories.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 공장이 없습니다.</td></tr>'; return; }

    const startDate = curMonth + '-01';
    // 월말 날짜 정확 계산 (4월=30일)
    const [cY, cM] = curMonth.split('-').map(Number);
    const lastDay = new Date(cY, cM, 0).getDate();
    const endDateStr = curMonth + '-' + String(lastDay).padStart(2, '0');
    
    const { data: invoices } = await window.mySupabase.from('invoices').select('factory_id, total_amount').gte('date', startDate).lte('date', endDateStr);
    const monthlyRevMap = {};
    if (invoices) invoices.forEach(inv => { monthlyRevMap[inv.factory_id] = (monthlyRevMap[inv.factory_id] || 0) + (inv.total_amount || 0); });

    const { data: fixedHotels } = await window.mySupabase.from('hotels').select('factory_id, fixed_amount, created_at').eq('contract_type', 'fixed');
    if (fixedHotels) fixedHotels.forEach(h => {
        const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
        if (curMonth >= createdMonth) {
            monthlyRevMap[h.factory_id] = (monthlyRevMap[h.factory_id] || 0) + Number(h.fixed_amount || 0);
        }
    });

    let totalRev = 0, operatingFactories = 0;
    const factorySales = [];

    // 필터링 (가입 대기 제외, 검색어 적용)
    const validFactories = factories.filter(f => f.status !== 'pending');
    
    validFactories.forEach(f => {
        const monthlyRevenue = monthlyRevMap[f.id] || 0;
        totalRev += monthlyRevenue;
        factorySales.push({ name: f.name, revenue: monthlyRevenue });
        if (f.status !== 'suspended') operatingFactories++;
    });

    document.getElementById('superTotalRevenue').innerText = totalRev.toLocaleString() + '원';
    document.getElementById('superTotalFactories').innerText = operatingFactories + '개';

    // TOP 10 매출 공장 렌더링
    const rankArea = document.getElementById('superFactoryRankingArea');
    if(rankArea) {
        rankArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
        factorySales.sort((a,b) => b.revenue - a.revenue).slice(0, 10).map((f, i) => `
            <tr><td>${i+1}위</td><td>${f.name}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f.revenue.toLocaleString()}원</td></tr>
        `).join('') + '</tbody></table>';
    }

    // 공장 목록 검색 필터링
    _superFactoryData = validFactories.filter(f => f.name.toLowerCase().includes(searchQuery));
    _superFactoryMap = monthlyRevMap;
    _superFactoryPage = 1;
    window.renderSuperFactoryPage();
};

window.renderSuperFactoryPage = function() {
    const tbody = document.getElementById('superFactoryList');
    if (!tbody) return;

    const total = _superFactoryData.length;
    const totalPages = Math.ceil(total / SUPER_FACTORY_PAGE_SIZE);
    const start = (_superFactoryPage - 1) * SUPER_FACTORY_PAGE_SIZE;
    const pageData = _superFactoryData.slice(start, start + SUPER_FACTORY_PAGE_SIZE);

    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">검색 결과가 없습니다.</td></tr>';
    } else {
        pageData.forEach(f => {
            const monthlyRevenue = _superFactoryMap[f.id] || 0;
            const statusMap = { 'active': '활성(운영중)', 'operating': '활성(운영중)', 'trial': '무료체험', 'expiring': '만료 임박', 'expired': '만료됨', 'suspended': '정지' };
            const sStatus = f.sub_status || 'active';
            const statusLabel = statusMap[sStatus] || '활성(운영중)';
            const badgeColors = { 'active': '#10b981', 'operating': '#10b981', 'trial': '#f59e0b', 'expiring': '#f59e0b', 'expired': '#ef4444', 'suspended': '#94a3b8' };
            const badgeBg = badgeColors[sStatus] || '#10b981';
            
            const subBadge = `<span style="background:${badgeBg}; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${statusLabel} (${sStatus})</span>`;
            const statusSelect = `<select onchange="updateFactoryStatus('${f.id}', this.value)" style="background:${f.status==='suspended'?'#94a3b8':'#00a8e8'}; color:white; border:none; padding:3px; border-radius:4px; font-size:12px;"><option value="operating" ${f.status==='operating'?'selected':''}>운영중</option><option value="suspended" ${f.status==='suspended'?'selected':''}>미운영</option></select>`;
            
            tbody.innerHTML += `<tr ${f.status === 'suspended' ? 'style="background-color: #f1f1f1;"' : ''}>
                <td title="${monthlyRevenue.toLocaleString()}원"><strong style="cursor:pointer; color:var(--primary);" onclick="window.openFactoryAdminView('${f.id}')">${f.name}</strong></td>
                <td>${f.admin_id}</td>
                <td>${statusSelect}</td>
                <td>${subBadge}</td>
                <td>${f.plan || '무료요금제'} / ${f.plan_expiry || '-'}</td>
                <td>
                    <button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border-style:none; margin-right:5px;" onclick="viewFactoryDetails('${f.id}', true)">수정</button>
                    <button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border-style:none;" onclick="deleteFactory('${f.id}')">삭제</button>
                </td>
            </tr>`;
        });
    }
    renderSuperFactoryPaging(totalPages);
}

function renderSuperFactoryPaging(totalPages) {
    const paging = document.getElementById('superPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const btnStyle = (act) => `padding:4px 10px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${act?'700':'400'}; background:${act?'var(--primary)':'white'}; color:${act?'white':'#334155'}; min-width:32px;`;

    const prev = document.createElement('button');
    prev.textContent = '◀';
    prev.style.cssText = btnStyle(false);
    prev.disabled = _superFactoryPage === 1;
    prev.style.opacity = _superFactoryPage === 1 ? '0.4' : '1';
    prev.onclick = () => { _superFactoryPage--; renderSuperFactoryPage({}); }; // map is global conceptually but we need it. Actually we don't need map for re-render if we store html or we can refetch. Wait! We must pass map! 
    // Let's attach map to window object or re-fetch. Better: Re-use the existing DOM or recreate.
    // I will fix the event listeners properly below by attaching data differently.
    paging.appendChild(prev);
    // (Paging logic will be properly wired below)
}
window.updateFactoryStatus = async function(fId, s) {
    await window.mySupabase.from('factories').update({ status: s }).eq('id', fId);
    window.loadSuperAdminDashboard();
};

window.loadPendingPayments = async function() {
    const tbody = document.getElementById('pendingPaymentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">데이터 로딩 중...</td></tr>';
    
    // 1. 결제 대기 데이터 가져오기
    const { data: payments, error: pErr } = await window.mySupabase.from('pending_payments').select('*');
    if (pErr) { console.error('결제 목록 로드 실패:', pErr); tbody.innerHTML = '<tr><td colspan="9">로드 실패</td></tr>'; return; }
    
    // 2. 모든 공장 데이터 가져오기 (매핑용)
    const { data: factories, error: fErr } = await window.mySupabase.from('factories').select('id, name, plan_expiry');
    const factoryMap = {};
    if (factories) {
        factories.forEach(f => factoryMap[f.id] = f);
    }
    
    tbody.innerHTML = '';
    (payments || []).forEach(p => {
        const f = factoryMap[p.factory_id] || {};
        const expiry = f.plan_expiry || '-';
        const totalAmount = p.total ? Number(p.total) : 0;
        tbody.innerHTML += `<tr>
            <td>${f.name || p.factory_name || '-'}</td>
            <td>${p.plan || '-'}</td>
            <td>${p.months || 0}개월</td>
            <td>${totalAmount.toLocaleString()}원</td>
            <td>${expiry}</td>
            <td>${p.request_tax_invoice ? '발행' : '미발행'}</td>
            <td>${p.depositor_name || '-'}</td>
            <td>${p.date || '-'}</td>
            <td>
                <button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="approvePayment('${p.id}')">승인</button>
                <button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectPayment('${p.id}')">반려</button>
            </td>
        </tr>`;
    });
};

window.loadApprovedPaymentsPage = async function() {
    const tbody = document.getElementById('approvedPaymentList');
    if (!tbody) return;

    if (_approvedPaymentData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">데이터 로딩 중...</td></tr>';
        
        const { data: payments, error: pErr } = await window.mySupabase.from('approved_payments').select('*').order('id', { ascending: false });
        if (pErr) { tbody.innerHTML = '<tr><td colspan="10">데이터 로드 실패</td></tr>'; return; }
        
        const { data: factories } = await window.mySupabase.from('factories').select('id, name');
        const factoryMap = {};
        if (factories) factories.forEach(f => factoryMap[f.id] = f.name);
        
        _approvedPaymentData = payments || [];
        _approvedPaymentMap = factoryMap;
        _approvedPaymentPage = 1;
    }

    const searchQuery = document.getElementById('searchApprovedPaymentInput')?.value.toLowerCase() || '';
    
    // 검색 필터 적용
    const filteredData = _approvedPaymentData.filter(p => {
        const fName = (_approvedPaymentMap[p.factory_id] || p.factory_name || '-').toLowerCase();
        return fName.includes(searchQuery);
    });

    const total = filteredData.length;
    const totalPages = Math.ceil(total / APPROVED_PAYMENT_PAGE_SIZE);
    const start = (_approvedPaymentPage - 1) * APPROVED_PAYMENT_PAGE_SIZE;
    const pageData = filteredData.slice(start, start + APPROVED_PAYMENT_PAGE_SIZE);

    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">결과가 없습니다.</td></tr>';
    } else {
        pageData.forEach(p => {
            const factoryName = _approvedPaymentMap[p.factory_id] || p.factory_name || '-';
            tbody.innerHTML += `<tr>
                <td>${factoryName}</td>
                <td>${p.plan || '-'}</td>
                <td>${p.months || 0}개월</td>
                <td style="text-align:right;">${Number(p.total).toLocaleString()}원</td>
                <td>${p.request_tax_invoice ? '요청' : '미요청'}</td>
                <td>${p.depositor_name || '이름없음'}</td>
                <td>${p.date || '-'}</td>
                <td>${p.approved_at || '-'}</td>
                <td>${p.new_expiry || '-'}</td>
                <td><button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="deleteApprovedPayment('${p.id}')">삭제</button></td>
            </tr>`;
        });
    }

    renderApprovedPaymentPaging(totalPages, total);
};

function renderApprovedPaymentPaging(totalPages, totalCount) {
    const paging = document.getElementById('approvedPaymentPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const btnStyle = (act) => `padding:4px 10px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${act?'700':'400'}; background:${act?'var(--primary)':'white'}; color:${act?'white':'#334155'}; min-width:32px; min-height:32px;`;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _approvedPaymentPage === 1;
    prevBtn.style.opacity = _approvedPaymentPage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _approvedPaymentPage--; window.loadApprovedPaymentsPage(); };
    paging.appendChild(prevBtn);

    let pageStart = Math.max(1, _approvedPaymentPage - 2);
    let pageEnd = Math.min(totalPages, pageStart + 4);
    if (pageEnd - pageStart < 4) pageStart = Math.max(1, pageEnd - 4);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _approvedPaymentPage);
        btn.onclick = ((p) => () => { _approvedPaymentPage = p; window.loadApprovedPaymentsPage(); })(i);
        paging.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _approvedPaymentPage === totalPages;
    nextBtn.style.opacity = _approvedPaymentPage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _approvedPaymentPage++; window.loadApprovedPaymentsPage(); };
    paging.appendChild(nextBtn);

    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px; display:inline-block;';
    info.textContent = `총 ${totalCount}건 / ${_approvedPaymentPage}페이지`;
    paging.appendChild(info);
}

window.deleteApprovedPayment = async function(pid) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('approved_payments').delete().eq('id', pid);
    _approvedPaymentData = []; // 강제 새로고침 유도
    window.loadApprovedPaymentsPage();
};

window.approvePayment = async function(paymentId) {
    if (!confirm('입금이 확인되었습니다. 요금제를 승인하시겠습니까?')) return;
    
    // Supabase에서 해당 결제 정보 가져오기
    const { data: payment, error: pErr } = await window.mySupabase.from('pending_payments').select('*').eq('id', paymentId).single();
    if (pErr || !payment) { alert('결제 내역을 찾을 수 없습니다.'); return; }
    
    const fId = payment.factory_id;
    // factories 테이블 가져오기
    const { data: f, error: fErr } = await window.mySupabase.from('factories').select('*').eq('id', fId).single();
    if (fErr || !f) { alert('해당 공장을 찾을 수 없습니다.'); return; }
    
    // expiry 갱신 로직: 
    // 1. 기존 만료일이 없거나 과거(이미 만료됨)면 오늘 날짜 기준
    // 2. 기존 만료일이 미래(아직 남음)면 그 만료일 기준
    let baseDate = new Date();
    if (f.plan_expiry) {
        const existingExpiry = new Date(f.plan_expiry);
        if (!isNaN(existingExpiry.getTime()) && existingExpiry > new Date()) {
            baseDate = existingExpiry;
        }
    }

    // 월 연장 (말일 보정: 1월 31일 + 1개월 -> 2월 28일/29일)
    const targetMonth = baseDate.getMonth() + parseInt(payment.months);
    const originalDay = baseDate.getDate();
    
    // 타겟 월의 1일로 설정 후 말일 계산
    const nextDate = new Date(baseDate.getFullYear(), targetMonth, 1);
    const lastDayOfTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    
    // 둘 중 작은 날짜를 선택하여 말일 넘김 방지
    nextDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    
    const newExpiry = nextDate.toISOString().split('T')[0];
    
    const { error: updateErr } = await window.mySupabase.from('factories')
        .update({ plan: payment.plan, sub_status: 'active', plan_expiry: newExpiry })
        .eq('id', fId);
        
    if (updateErr) { alert('공장 정보 업데이트 실패: ' + updateErr.message); return; }
    
    // 승인 내역 저장
    await window.mySupabase.from('approved_payments').insert([{ ...payment, approved_at: getTodayString(), new_expiry: newExpiry }]);
    await window.mySupabase.from('pending_payments').delete().eq('id', paymentId);
    
    if(typeof window.fetchFromSupabase === 'function') await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
    alert('결제 승인이 완료되었습니다.');
};

window.rejectPayment = async function(paymentId) {
    if (!confirm('정말 결제 신청 내역을 삭제하시겠습니까?')) return;
    
    const { error } = await window.mySupabase.from('pending_payments').delete().eq('id', paymentId);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    
    if(typeof window.fetchFromSupabase === 'function') await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
};

// [v38 SQL-First] 중복된 deleteApprovedPayment 제거됨

// [v34 버그픽스] 로그인 화면에서 "플랫폼 관리자" 드롭다운 아이템 보이기
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// [v34 최후의 버그픽스] 플랫폼 총괄 관리자 메뉴 보이기 (지연 실행 강제화)
setTimeout(() => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
}, 300);

window.addEventListener('load', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// 해시가 동적으로 바뀌는 경우(페이지 안에서 URL만 추가된 경우)에도 즉시 체크
window.addEventListener('hashchange', () => {
    const saOption = document.getElementById('saOption');
    if (window.location.hash === '#superadmin') {
        if (saOption) saOption.style.display = 'block';
    } else {
        if (saOption) saOption.style.display = 'none';
    }
});


window.loadAdminDashboard = async function() {
    console.log("DEBUG: [v37] loadAdminDashboard DB version started");

    const statsMonth = document.getElementById('adminStatsMonth');
    if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);
    const curMonth = statsMonth ? statsMonth.value : getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
// 1. 공장 정보 및 구독 상태 로드
    const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!f) return;

    // 구독 배너
    const subStatusLeft = document.getElementById('subStatusLeft');
    const subPlanRight = document.getElementById('subPlanRight');
    const subBanner = document.getElementById('subBanner');
    
    if (subStatusLeft && subPlanRight && subBanner) {
        const subLabel = f.sub_status === 'expired' ? '만료됨' : (f.sub_status === 'expiring' ? '만료임박' : '활성(사용중)');
        subStatusLeft.innerHTML = '구독상태: ' + subLabel;
        subPlanRight.innerHTML = '요금제: ' + (f.plan || '라이트') + ' | 만료일: ' + (f.plan_expiry || '제한없음');
        subBanner.style.background = f.sub_status === 'expired' ? '#fee2e2' : (f.sub_status === 'expiring' ? '#fef3c7' : '#e0f2fe');
    }

    // 2. 매출 요약 계산 (DB 조회)
    await window.calculateAdminDashStats();

    // 3. 거래처 드롭다운 업데이트
    const { data: hotels } = await window.mySupabase
        .from('hotels')
        .select('id, name')
        .eq('factory_id', currentFactoryId)
        .order('name');

    if(hotels) hotels.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
        const select = document.getElementById(id);
        if(select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="all">전체 거래처</option>';
            if(hotels) hotels.forEach(h => select.innerHTML += '<option value="' + h.id + '">' + h.name + '</option>');
            select.value = currentVal || 'all';
        }
    });

    // 4. 거래명세서 목록 로드 및 차트 데이터 갱신
    await window.loadAdminRecentInvoices();
    await window.updateTrendChartOnly();

    // 5. 첫 접속 시 가이드 투어 자동 시작
    if (!localStorage.getItem('tour_completed_' + currentFactoryId)) {
        setTimeout(window.startAdminTour, 500);
    }
};

window.startAdminTour = function() {
    const driverObj = window.driver.js.driver({
        showProgress: true,
        allowClose: false,
        doneBtnText: '완료',
        nextBtnText: '다음 ▶',
        prevBtnText: '◀ 이전',
        progressText: '{{current}} / {{total}}',
        steps: [
            { 
                element: '#tour-step-1', 
                popover: { 
                    title: '1. 기본 단가 설정', 
                    description: '환영합니다! 가장 먼저 우리 공장의 세탁물 기본 단가를 설정해주세요. 이 단가가 모든 거래처의 기본값이 됩니다.', 
                    side: 'bottom', align: 'start' 
                } 
            },
            { 
                element: '#tour-tab-hotel', 
                popover: { 
                    title: '2. 거래처 메뉴 이동', 
                    description: '기본 단가를 설정하셨다면, 거래처를 등록하러 가볼까요?',
                    onNextClick: () => { 
                        document.getElementById('tour-tab-hotel').click(); 
                        setTimeout(() => driverObj.moveNext(), 300);
                    } 
                } 
            },
            { 
                element: '#tour-btn-hotel', 
                popover: { 
                    title: '3. 거래처 등록', 
                    description: '여기를 눌러 거래처를 등록하세요. 거래처마다 개별 단가를 다르게 설정할 수도 있습니다.' 
                } 
            },
            { 
                element: '#tour-tab-staff', 
                popover: { 
                    title: '4. 직원 메뉴 이동', 
                    description: '명세서를 발행할 현장 직원을 등록해야 합니다. 이 탭을 클릭하세요.',
                    onNextClick: () => { 
                        document.getElementById('tour-tab-staff').click(); 
                        setTimeout(() => driverObj.moveNext(), 300);
                    } 
                } 
            },
            { 
                element: '#tour-btn-staff', 
                popover: { 
                    title: '5. 직원 등록', 
                    description: '직원 계정을 생성하면, 해당 아이디로 현장직원 화면에 로그인하여 명세서를 발행할 수 있습니다! 이제 준비가 완료되었습니다 🎉' 
                } 
            }
        ],
        onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("튜토리얼을 종료하시겠습니까?")) {
                localStorage.setItem('tour_completed_' + currentFactoryId, 'true');
                driverObj.destroy();
                // 튜토리얼 종료 후 다시 현황 탭으로 복귀
                document.querySelector('.tab-item[onclick*="adminStats"]').click();
            }
        }
    });
    driverObj.drive();
};

window.updateTrendChartOnly = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // [Fix] Fetch hotel created_at first if filtered to exclude old invoices
    let hotelCreatedDate = null;
    if (hotelFilter !== 'all') {
        const { data: h } = await window.mySupabase.from('hotels').select('created_at').eq('id', hotelFilter).single();
        if (h) hotelCreatedDate = h.created_at.substring(0, 10);
    }
    
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') {
        invQuery = invQuery.eq('hotel_id', hotelFilter);
        if (hotelCreatedDate) invQuery = invQuery.gte('date', hotelCreatedDate);
    }
    console.log("DEBUG: invQuery params - factoryId:", currentFactoryId, "filter:", hotelFilter, "createdDate:", hotelCreatedDate);
    const { data: invData, error: invErr } = await invQuery;
    console.log("DEBUG: invData:", invData, "error:", invErr);
    
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount, created_at').eq('factory_id', currentFactoryId);
    // Remove the filter here so we load all hotels to aggregate total fixed amounts
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
            console.log("DEBUG: Processing hotel", h.name, "createdMonth", createdMonth, "filter", hotelFilter);
            
            // If viewing a specific hotel, only add its fixed amount
            if (hotelFilter !== 'all' && h.id !== hotelFilter) return;

            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    if (mKey >= createdMonth) {
                        monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                    }
                }
            }
            
            // For specific hotel, clear months before creation
            if (hotelFilter !== 'all' && h.id === hotelFilter) {
                for (const mKey in monthlyTrend) {
                    if (mKey < createdMonth) {
                        monthlyTrend[mKey] = 0;
                    }
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? (hotelData.find(h => h.id === hotelFilter)?.name || '선택 거래처') : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};
console.log("DEBUG: APP V38 LOADED");
window.loadAdminRecentInvoices = async function(returnList = false) {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
    const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
    const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

    let query = window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
        .eq('factory_id', currentFactoryId);

    if (sDate) query = query.gte('date', sDate);
    if (eDate) query = query.lte('date', eDate);
    if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

    const { data, error } = await query.order('date', { ascending: false }).limit(100);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
        const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
        const statusBadge = inv.is_sent 
            ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

        tbody.innerHTML += `
        <tr>
            <!-- 체크박스 열 추가 -->
            <td><input type="checkbox" class="invoice-checkbox" value="${inv.id}"></td>
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
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    // contract_type === 'special' 로 간주할지, hotelType 필드가 따로 있는지 확인. 여기서는 임의로 호환.
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
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

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
        const ids = list.map(inv => inv.id);
        await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
        
        alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
        window.loadAdminRecentInvoices(); 
    }
};
let isInvoiceLoading = false;
window.loadAdminRecentInvoices = async function(returnList = false) {
    if (isInvoiceLoading) return; // 중복 호출 방지
    isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

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
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(inv => {
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
    } finally {
        isInvoiceLoading = false;
    }
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
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

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, items, is_sent')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
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
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;

    } else {
        // [일반거래처] 매트릭스 방식 복원
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*') // items 포함 전체 컬럼
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('에러: ' + error.message); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + Number(it.qty||0);
            itemInfoMap[it.name] = { price: Number(it.price) || 0, unit: it.unit || '개', category: it.category || '기타' };
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

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};



window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    // [v37] 수정: items 포함해서 가져오기 (총합계 계산용)
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate);

    if(error) { alert('에러: ' + error.message); return; }
    if(!list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = `
        <div style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
            <h2 style="text-align:center;">정산명세서 발송 (${h.name})</h2>
            <div style="text-align:right; margin-bottom:10px;">조회 기간: ${sDate} ~ ${eDate}</div>
            
            <div style="margin-top:20px; padding:20px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="color:var(--secondary); font-size:14px;">공급가: ₩ ${supplyPrice.toLocaleString()} <br> 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-size:22px; color:var(--primary);">총 발송금액: ₩ ${totalAmount.toLocaleString()}</div>
            </div>

            <div style="text-align:center; margin-top:30px;">
                <button id="sendInvBtn" style="padding: 15px 40px; font-size: 18px; cursor:pointer; background:var(--primary); color:white; border:none; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    🚀 카카오톡 알림톡 발송하기 (${list.length}건)
                </button>
            </div>
        </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 정산명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            window.loadAdminRecentInvoices(); 
        }
    };
    
    openModal('sendInvoiceModal');
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, total_amount, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    // 품목 순서: hotel_item_prices 저장 순서 기준
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
        // category_name도 보완
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let bodyHtml = '';

    if (isSpecial) {
        // 특수거래처: 카테고리별 2단 그리드 (합계 기준)
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
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

        bodyHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">${categoriesHtml}</div>`;

    } else {
        // 일반거래처: 날짜×품목 매트릭스
        const itemTotals = {};
        itemNames.forEach(name => {
            itemTotals[name] = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
        });

        bodyHtml = `
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-size:11px;">
            <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">일자</th>
                ${itemNames.map(n => `<th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${n}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${dateSequence.map(d => `
                <tr>
                    <td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center; font-weight:700; background:#f8fafc;">${d.slice(8)}</td>
                    ${itemNames.map(name => `<td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">${(dailyData[d] && dailyData[d][name]) || 0}</td>`).join('')}
                </tr>`).join('')}
                <tr style="background:#e2e8f0; font-weight:700;">
                    <td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">수량 합계</td>
                    ${itemNames.map(name => `<td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">${itemTotals[name]}</td>`).join('')}
                </tr>
                <tr style="background:#f8fafc;">
                    <td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center; font-weight:700;">단가</td>
                    ${itemNames.map(name => `<td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                </tr>
                <tr style="background:#e0f2fe; font-weight:700; color:#0369a1;">
                    <td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">항목 합계</td>
                    ${itemNames.map(name => `<td style="padding:5px 6px; border:1px solid #cbd5e1; text-align:center;">₩ ${(itemTotals[name] * Number(itemInfoMap[name].price)).toLocaleString()}</td>`).join('')}
                </tr>
            </tbody>
        </table>`;
    }

    const reportHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: 'Malgun Gothic', sans-serif; }
    </style></head>
    <body>
        <h2 style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:8px;">세탁 거래명세서 (${h.name})</h2>
        <div style="text-align:right; margin-bottom:10px; font-size:12px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
        ${bodyHtml}
        <div style="margin-top:16px; padding:14px 18px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight:700; font-size:16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
    </body></html>`;

    const printWin = window.open('', '', 'width=1000,height=900');
    if (!printWin) { alert('팝업 차단을 해제해주세요.'); return; }
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    // [Fix 3] Query invoice_items instead of items
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
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
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
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
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
                        ${Object.keys(itemInfoMap).map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
            <div style="text-align:center; margin-top:20px;">
                <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            </div>
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 ${list.length}건의 명세서를 발송하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('카카오톡 알림톡 발송 요청이 완료되었습니다.');
            window.loadAdminRecentInvoices(); 
            closeModal('sendInvoiceModal');
        }
    };
    
    openModal('sendInvoiceModal');
};



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
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    // 품목 순서: hotel_item_prices 저장 순서 기준
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

    let bodyHtml = '';

    if (isSpecial) {
        // 특수거래처: 카테고리별 2단 그리드 (합계 기준)
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
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

        bodyHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">${categoriesHtml}</div>`;

    } else {
        // 일반거래처: 날짜×품목 매트릭스
        const itemTotals = {};
        itemNames.forEach(name => {
            itemTotals[name] = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
        });

        const thS = `style="padding:3px 5px; border:1px solid #cbd5e1; text-align:center; background:#f1f5f9; font-size:11px; white-space:nowrap;"`;
        const tdS = `style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px;"`;
        const tdB = `style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px; font-weight:700; background:#f8fafc;"`;

        bodyHtml = `
        <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:500px;">
            <thead><tr>
                <th ${thS}>일자</th>
                ${itemNames.map(n => `<th ${thS}>${n}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${dateSequence.map(d => `<tr>
                    <td ${tdB}>${d.slice(8)}</td>
                    ${itemNames.map(name => `<td ${tdS}>${(dailyData[d] && dailyData[d][name]) || 0}</td>`).join('')}
                </tr>`).join('')}
                <tr><td ${tdB}>수량 합계</td>${itemNames.map(name => `<td ${tdB}>${itemTotals[name]}</td>`).join('')}</tr>
                <tr><td ${tdB}>단가</td>${itemNames.map(name => `<td ${tdS}>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}</tr>
                <tr style="background:#e0f2fe;">
                    <td ${tdB}>항목 합계</td>
                    ${itemNames.map(name => {
                        const amt = itemTotals[name] * Number(itemInfoMap[name].price);
                        return `<td style="padding:2px 4px; border:1px solid #cbd5e1; text-align:center; font-size:11px; font-weight:700; color:#0369a1;">₩ ${amt.toLocaleString()}</td>`;
                    }).join('')}
                </tr>
            </tbody>
        </table>
        </div>`;
    }

    const reportHtml = `
        <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:10px;">
            <h2 style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:8px; font-size:18px;">
                세탁 거래명세서 (${h.name})
            </h2>
            <div style="text-align:right; margin-bottom:8px; font-size:12px; color:#64748b;">
                조회 기간: ${sDate} ~ ${eDate}
            </div>
            ${bodyHtml}
            <div style="margin-top:8px; padding:8px 12px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:13px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:14px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </div>
        <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
            <button id="sendInvBtn" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
            <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;

    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처에 "${sDate} ~ ${eDate}" 의 정산 명세서를 발송 처리하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            const groupId = `g_${sDate}_${eDate}_${Date.now()}`;
            const { error: updateErr } = await window.mySupabase.from('invoices')
                .update({ is_sent: true, sent_group_id: groupId }).in('id', ids);
            if (updateErr) { alert('오류: ' + updateErr.message); return; }
            // sent_logs 저장
            const sentLogData = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: `${sDate} ~ ${eDate}`,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            const { error: logErr } = await window.mySupabase.from('sent_logs').insert([sentLogData]);
            if (logErr) console.error('sent_logs 저장 오류:', logErr.message);
            alert('발송 처리 완료!');
            if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            closeModal('sendInvoiceModal');
        }
    };

    openModal('sendInvoiceModal');
};
window.loadAdminHotelList = async function() {
    const tbody = document.getElementById('adminHotelList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">거래처 목록을 불러오는 중...</td></tr>';

    const { data: hotels, error } = await window.mySupabase.from('hotels').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`; return; }
    if(!hotels || hotels.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 거래처가 없습니다.</td></tr>'; return; }

    tbody.innerHTML = '';
    hotels.forEach(h => {
        const badgeClass = h.contract_type === 'fixed' ? 'badge-fixed' : 'badge-unit';
        const badgeText = h.contract_type === 'fixed' ? '정액제' : '단가제';
        tbody.innerHTML += `<tr>
            <td><strong>${h.name}</strong></td>
            <td style="font-size:13px; color:var(--secondary);">${h.ceo || '-'}<br>${h.phone || '-'}</td>
            <td style="font-size:13px; color:var(--secondary);">${h.login_id}<br>****</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <button class="btn-mng btn-info" onclick="openHotelModal('${h.id}')">정보수정</button>
                <button class="btn-mng btn-price" onclick="openPriceSetting('${h.id}')">단가수정</button>
                <button class="btn-mng btn-del" onclick="deleteHotel('${h.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.openHotelModal = async function(hId = null) {
    window.editingHotelIdForInfo = hId;
    editingHotelId = hId; // 동기화
    const modal = document.getElementById('hotelModal'),
          title = modal.querySelector('h3'),
          btn = modal.querySelector('.btn-save');

    // Clear/Reset fields
    ['h_name', 'h_ceo', 'h_phone', 'h_bizNo', 'h_address', 'h_fixedAmount', 'h_loginId', 'h_loginPw'].forEach(f => {
        const el = document.getElementById(f);
        if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
        const err = document.getElementById('err_' + f);
        if(err) err.style.display = 'none';
    });
    document.getElementById('h_contractType').value = 'unit';
    document.getElementById('h_fixedAmountGroup').style.display = 'none';
    const genRadio = document.querySelector('input[name="h_type"][value="general"]');
    if (genRadio) genRadio.checked = true;

    if (hId) {
        title.innerText = '🤝 거래처 정보 수정';
        btn.innerText = '수정 완료';
        const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
        if(h) {
            document.getElementById('h_name').value = h.name;
            document.getElementById('h_ceo').value = h.ceo || '';
            document.getElementById('h_phone').value = h.phone || '';
            document.getElementById('h_bizNo').value = h.biz_no || '';
            document.getElementById('h_address').value = h.address || '';
            document.getElementById('h_contractType').value = h.contract_type;
            document.getElementById('h_fixedAmount').value = h.fixed_amount || '0';
            document.getElementById('h_loginId').value = h.login_id || '';
            document.getElementById('h_loginPw').value = h.login_pw || '';
            if(h.hotel_type) {
                const rb = document.querySelector(`input[name="h_type"][value="${h.hotel_type}"]`);
                if(rb) rb.checked = true;
            }
            if(typeof toggleFixedAmountField === 'function') toggleFixedAmountField();
        }
    } else {
        title.innerText = '🤝 신규 거래처 등록';
        btn.innerText = '거래처 등록';
        
        // 신규 등록 시 공장 기본 단가 불러오기
        window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId).then(({data}) => {
            window.tempDefaultItems = data || [];
        });
    }
    openModal('hotelModal');
};

window.saveNewHotel = async function() {
    // [추가] 요금제 제한 확인 (비즈니스 미만일 경우 제한)
    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkHotelLimit(f)) return;

    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red';
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)';
            if(err) err.style.display = 'none';
        }
    });

    if (!isValid) return;

    // 아이디 중복 체크 로직
    const targetLoginId = document.getElementById('h_loginId').value.trim();
    
    // 수정 시에는 자기 자신을 제외하고 중복 체크
    const query = window.mySupabase.from('hotels').select('id').eq('login_id', targetLoginId);
    if (editingHotelId) {
        query.neq('id', editingHotelId);
    }
    
    const { data: duplicate } = await query.maybeSingle();
    if (duplicate) { alert('이미 사용 중인 거래처 ID입니다. 다른 ID를 입력해주세요.'); return; }

    const payload = {
        factory_id: currentFactoryId,
        hotel_type: document.querySelector('input[name="h_type"]:checked').value,
        name: document.getElementById('h_name').value.trim(),
        ceo: document.getElementById('h_ceo').value.trim(),
        phone: document.getElementById('h_phone').value.trim(),
        biz_no: document.getElementById('h_bizNo').value.trim(),
        address: document.getElementById('h_address').value.trim(),
        contract_type: document.getElementById('h_contractType').value,
        fixed_amount: Number(document.getElementById('h_fixedAmount').value) || 0,
        login_id: document.getElementById('h_loginId').value.trim(),
        login_pw: document.getElementById('h_loginPw').value.trim()
    };

    if(window.editingHotelIdForInfo) {
        await window.mySupabase.from('hotels').update(payload).eq('id', window.editingHotelIdForInfo);
        alert('거래처 정보가 수정되었습니다.');
    } else {
        payload.id = 'h_' + Date.now();
        const { data: insertedHotel } = await window.mySupabase.from('hotels').insert([payload]).select().single();
        
        // [신규 등록 후 기본 단가 자동 적용]
        console.log("DEBUG: tempDefaultItems:", window.tempDefaultItems);
        if (window.tempDefaultItems && window.tempDefaultItems.length > 0 && insertedHotel) {
            console.log("DEBUG: Inserting default prices for hotel:", insertedHotel.id);
            // "기본" 카테고리 확인/생성
            let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', insertedHotel.id).eq('name', '기본').maybeSingle();
            if (!cat) {
                const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: insertedHotel.id, name: '기본' }]).select().single();
                if (res.data) cat = res.data;
            }
            
            if (cat) {
                const inserts = window.tempDefaultItems.map((d, i) => ({
                    factory_id: currentFactoryId,
                    hotel_id: insertedHotel.id,
                    category_id: cat.id,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: d.sort_order || i // [수정] 기본 단가표의 sort_order를 우선 사용하고 없으면 i 사용
                }));
                const { error: insertErr } = await window.mySupabase.from('hotel_item_prices').insert(inserts);
                if (insertErr) console.error("DEBUG: Insert items error:", insertErr);
                else console.log("DEBUG: Default items inserted successfully");
            }
            window.tempDefaultItems = [];
        }
        
        alert('신규 거래처가 등록되었습니다.');
    }
    closeModal('hotelModal');
    window.loadAdminHotelList();
};

window.deleteHotel = async function(hId) {
    if(confirm('정말 이 거래처를 삭제하시겠습니까? 관련된 명세서도 표시되지 않을 수 있습니다.')) {
        await window.mySupabase.from('hotels').delete().eq('id', hId);
        window.loadAdminHotelList();
    }
};

window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId;
    
    // 1. 거래처 타입 확인
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // [경고] 정액제 거래처 경고창 활성화
    if (h.contract_type === 'fixed' || h.contract_type === '정액제') {
        alert('⚠️ 정액제 거래처의 거래명세서는 매출에 영향을 주지 않습니다!');
    }
    
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    // 2. 데이터 초기화 및 로드
    if (isSpecial) {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        await window.loadHotelCategoryList();
        await window.loadHotelPriceList(); 
        openModal('priceSettingModal');
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        await window.loadSimplePriceList();
        openModal('simplePriceModal');
    }
};

window.loadHotelCategoryList = async function() {
    const hId = window.editingHotelIdForPrice;
    
    const { data: hotel } = await window.mySupabase.from('hotels').select('contract_type, hotel_type').eq('id', hId).single();
    const isSpecial = hotel && (hotel.contract_type === 'special' || hotel.hotel_type === 'special');

    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    // [FORCE DELETE] If special, delete '기타', '삭제', '기본' categories
    if (isSpecial && cats) {
        const toDelete = cats.filter(c => c.name === '기타' || c.name === '삭제' || c.name === '기본');
        if (toDelete.length > 0) {
            for (const cat of toDelete) {
                await window.mySupabase.from('hotel_categories').delete().eq('id', cat.id);
            }
            return window.loadHotelCategoryList(); // reload
        }
    }
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    if(tagContainer) tagContainer.innerHTML = '';
    if(select) select.innerHTML = '<option value="">선택하세요</option>';
    
    if (cats) {
        cats.forEach(c => {
            if (c.name === '삭제') return; // 필터링: '삭제' 카테고리 무조건 제외
            if (isSpecial && c.name === '기타') return; // 특수거래처에서 기타 제외
            
            if(tagContainer) {
                tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} <button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>
                </span>`;
            }
            if(select) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
    }
};

    // Task 1: 품목 추가 로직 (addSimpleItem) 에서 이미 category_id 추가함.
    // Task 3: 정액제 거래처 경고 완료.
    // Task 2: '삭제' 카테고리 디폴트 추가 방지 로직 (예상되는 곳: 카테고리 생성 시)
    // 아래는 addHotelCategory 수정 (카테고리 생성 시 '삭제'라는 이름이면 차단)
    window.addHotelCategory = async function() {
        const input = document.getElementById('new_h_cat_name');
        const catName = input.value.trim();
        if(!catName || catName === '삭제') { alert('올바른 카테고리명을 입력하세요.'); return; }
        const hId = window.editingHotelIdForPrice;
        
        const { data: exist } = await window.mySupabase.from('hotel_categories').select('id').eq('hotel_id', hId).eq('name', catName).single();
        if(exist) { alert('이미 존재하는 카테고리입니다.'); input.focus(); return; }
        
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: catName }]);
        input.value = '';
        await window.loadHotelCategoryList();
        input.focus(); // [수정] 카테고리명 입력창으로 커서 복귀
    };

window.deleteHotelCategory = async function(catId) {
    if(!confirm('삭제하시겠습니까? 이 카테고리에 속한 품목도 모두 함께 삭제됩니다.')) return;
    await window.mySupabase.from('hotel_categories').delete().eq('id', catId);
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
};

window.addHotelCustomItem = async function() {
    // [강제 캐시 갱신] Supabase가 최신 테이블 구조를 인식하게 함 ( category_id, category_name 인식용 )
    await window.mySupabase.from('hotel_item_prices').select('category_id, category_name').limit(1);

    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    
    const selectEl = document.getElementById('hp_cat');
    const catId = selectEl.value;
    
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    if(!catId) { alert('카테고리를 선택해주세요.'); return; }
    
    // [보안] catId로 카테고리 이름을 확실히 조회!
    const { data: catData } = await window.mySupabase.from('hotel_categories').select('name').eq('id', catId).single();
    const finalCatName = catData ? catData.name : '기본';

    // [정렬] 가장 하단으로 추가 (Timestamp 기반, Integer 범위 초과 방지)
    const nextOrder = Math.floor(Date.now() / 1000);

    const payload = {
        factory_id: String(currentFactoryId),
        hotel_id: String(hId),
        name: String(name),
        price: Number(price),
        unit: String(unit),
        category_id: String(catId),
        category_name: String(finalCatName),
        sort_order: nextOrder
    };
    
    // 이미 같은 이름의 품목이 있는지 확인
    const { data: exist } = await window.mySupabase.from('hotel_item_prices')
        .select('id')
        .eq('hotel_id', hId)
        .eq('name', name)
        .maybeSingle();

    if (exist) {
        // 이미 있으면 업데이트
        const { error: updateError } = await window.mySupabase.from('hotel_item_prices')
            .update({
                price: payload.price,
                unit: payload.unit,
                category_id: payload.category_id,
                category_name: payload.category_name,
                sort_order: payload.sort_order
            })
            .eq('id', exist.id);
            
        if (updateError) {
            alert('업데이트 실패: ' + updateError.message);
            return;
        }
    } else {
        // 없으면 새롭게 삽입
        const { error: insertError } = await window.mySupabase.from('hotel_item_prices')
            .insert([payload]);

        if (insertError) {
            console.error("DEBUG: Insert Error details:", insertError);
            alert('품목 추가 실패: ' + insertError.message);
            return;
        }
    }

    await window.loadHotelPriceList();
    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
    document.getElementById('hp_name').focus();
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    
    // 선택된 카테고리
    const catSelect = document.getElementById('hp_cat');
    const selectedCatId = catSelect ? catSelect.value : '';
    
    // 모든 품목 조회
    let query = window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, category_id, category_name, sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true }); // [Task 1] 단가수정 화면 순서와 동일하게 정렬
    
    const { data: items, error } = await query;
    
    const tbody = document.getElementById('hotelPriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    // 카테고리 필터링 적용
    const filteredItems = items.filter(it => {
        if (selectedCatId && selectedCatId !== '') {
            return it.category_id === selectedCatId;
        }
        return it.category_name !== '삭제';
    });
    
    filteredItems.forEach(it => {
        tbody.innerHTML += `<tr>
            <td style="background:#f8fafc;"><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteHotelPrice = async function(itemId) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', itemId);
    await window.loadHotelPriceList();
};
window.loadAdminDefaultPriceList = async function() {
    const tbody = document.getElementById('adminDefaultPriceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기본 품목을 불러오는 중...</td></tr>';

    const { data: items, error } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if(error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">조회 에러: ${error.message}</td></tr>`;
        return;
    }
    console.log("DEBUG: Admin Default Prices:", items);
    console.log("DEBUG: Admin Default Prices Names:", items ? items.map(i => i.name) : 'None');
    console.log("DEBUG: Admin Default Prices SortOrder:", items ? items.map(i => i.sort_order) : 'None');

    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">등록된 기본 품목이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
        tbody.innerHTML += `
        <tr style="height:35px;">
            <td style="padding:4px 8px;"><input type="number" value="${item.sort_order || 0}" style="width:40px;" onchange="updateDefaultPriceOrder('${item.id}', this.value)"></td>
            <td style="padding:4px 8px;">${item.name}</td>
            <td style="padding:4px 8px;">${item.price.toLocaleString()}원</td>
            <td style="padding:4px 8px;">${item.unit}</td>
            <td style="padding:4px 8px;">
                <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice('${item.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.updateDefaultPriceOrder = async function(id, newOrder) {
    console.log("DEBUG: Updating sort_order to:", newOrder, "for ID:", id);
    const { error } = await window.mySupabase.from('factory_default_prices').update({ sort_order: Number(newOrder) || 0 }).eq('id', id);
    if(error) {
        console.error("DEBUG: Update order error:", error);
    }
    await window.loadAdminDefaultPriceList();
};

window.saveDefaultPrice = async function() {
    const nameEl = document.getElementById('dp_name');
    const priceEl = document.getElementById('dp_price');
    const unitEl = document.getElementById('dp_unit');

    const name = nameEl.value.trim();
    const price = Number(priceEl.value) || 0;
    const unit = unitEl.value.trim() || '개';

    if(!name) { alert('품목명을 입력해주세요.'); return; }

    // 기존 품목 개수 확인하여 다음 순서 할당
    const { data: existingItems } = await window.mySupabase.from('factory_default_prices')
        .select('sort_order')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextOrder = existingItems ? (existingItems.sort_order + 1) : 1;

    const payload = {
        factory_id: currentFactoryId,
        name: name,
        price: price,
        unit: unit,
        sort_order: nextOrder
    };

    const { error } = await window.mySupabase.from('factory_default_prices')
        .upsert(payload, { onConflict: 'factory_id, name' });

    if(error) {
        alert('저장에 실패했습니다: ' + error.message);
        return;
    }

    // 입력창 초기화 및 목록 갱신
    nameEl.value = '';
    priceEl.value = '0';
    unitEl.value = '개';
    nameEl.focus();
    
    await window.loadAdminDefaultPriceList();
};

window.deleteDefaultPrice = async function(id) {
    if(!confirm('해당 기본 품목을 삭제하시겠습니까?')) return;

    const { error } = await window.mySupabase.from('factory_default_prices')
        .delete()
        .eq('id', id);

    if(error) {
        alert('삭제에 실패했습니다: ' + error.message);
        return;
    }

    await window.loadAdminDefaultPriceList();
};

window.openDefaultPriceSetting = function() { 
    openModal('defaultPriceModal'); 
    window.loadAdminDefaultPriceList(); 
};

// ... 로직 통합 완료 ...

window.loadHotelPriceList = async function() {
    console.log("DEBUG: 최신 loadHotelPriceList 호출");
    const hId = window.editingHotelIdForPrice;
    
    // 선택된 카테고리
    const catSelect = document.getElementById('hp_cat');
    const selectedCatId = catSelect ? catSelect.value : '';
    
    // 모든 품목 조회 (sort_order 기반 정렬)
    let query = window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name, category_id')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true });
    
    const { data: items, error } = await query;
    
    const tbody = document.getElementById('hotelPriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    // 카테고리 필터링 적용
    const filteredItems = items.filter(it => {
        if (selectedCatId && selectedCatId !== '' && selectedCatId !== 'all') {
            return it.category_id === selectedCatId;
        }
        return it.category_name !== '삭제';
    });
    
    filteredItems.forEach(it => {
        tbody.innerHTML += `<tr>
            <td style="background:#f8fafc;"><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.loadSimplePriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    console.log("DEBUG: loadSimplePriceList for hotel:", hId);
    // [수정] select('*')를 명시적인 컬럼 지정으로 변경하여 정확하게 데이터 가져오기!
    const { data: items, error } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, created_at')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    console.log("DEBUG: Final Sorted Items:", items ? items.map(i => ({name: i.name, sort_order: i.sort_order})) : 'None');
    console.log("DEBUG: Hotel Items Info Detail:", JSON.stringify(items.map(i => ({name: i.name, sort_order: i.sort_order}))));
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }

    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${it.id}')">삭제</button></td>
        </tr>`;
    });
};

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    // [v38 Fix] Find category ID correctly
    let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
    
    // If no category found at all, create '기본'
    if (!cat) {
        const { data: newCat, error: catError } = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
        cat = newCat;
    }

    // [정렬] 가장 하단으로 추가 (Repair Nulls first)
    const { data: allItems } = await window.mySupabase.from('hotel_item_prices')
        .select('id, sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: false });

    let maxS = 0;
    if (allItems) {
        allItems.forEach(it => {
            if(it.sort_order != null && it.sort_order > maxS) maxS = it.sort_order;
        });
        
        // Repair nulls
        for (const it of allItems) {
            if (it.sort_order == null) {
                maxS++;
                await window.mySupabase.from('hotel_item_prices').update({ sort_order: maxS }).eq('id', it.id);
            }
        }
    }
    const nextOrder = maxS + 1;

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit,
        category_id: cat ? cat.id : null,
        category_name: (cat && cat.name) ? cat.name : '기본',
        sort_order: nextOrder
    };
    
    // Explicitly casting values
    const finalPayload = {
        factory_id: payload.factory_id,
        hotel_id: payload.hotel_id,
        name: String(payload.name),
        price: Number(payload.price),
        unit: String(payload.unit),
        category_id: payload.category_id ? String(payload.category_id) : null,
        category_name: String(payload.category_name),
        sort_order: Number(payload.sort_order)
    };
    
    console.log("DEBUG: Final Payload:", JSON.stringify(finalPayload));
    
    const { data: inserted, error: insertError } = await window.mySupabase.from('hotel_item_prices').insert([finalPayload]);
    
    if (insertError) {
        console.error("DEBUG: Insert failed:", insertError);
        alert('품목 추가 실패: ' + insertError.message);
        return;
    }
    
    if (insertError) {
        console.error("DEBUG: Insert failed:", insertError);
        alert('품목 추가 실패: ' + insertError.message);
        return;
    }
    
    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
    await window.loadSimplePriceList();
};

window.deleteSimpleItem = async function(id) {
    if(!confirm('삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', id);
    await window.loadSimplePriceList();
};

window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type, hotel_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        alert('데이터를 찾을 수 없습니다.'); return; 
    }

    const isSpecial = inv.hotels && (inv.hotels.contract_type === 'special' || inv.hotels.hotel_type === 'special');
    
    // 명세서에 실제 저장된 항목들 맵으로 캐싱
    const savedItemsMap = {};
    (inv.invoice_items || []).forEach(it => { savedItemsMap[it.name] = Number(it.qty || 0); });

    // 단가표 전체 불러오기 (수량 0인 것도 보여주기 위함)
    let { data: priceList } = await window.mySupabase.from('hotel_item_prices')
        .select('name, price, unit, sort_order, category_name')
        .eq('hotel_id', inv.hotel_id)
        .order('sort_order', { ascending: true, nullsFirst: false });

    // 거래처 개별 단가표가 없으면 공장 기본 단가표 가져오기
    if (!priceList || priceList.length === 0) {
        const { data: defaultList } = await window.mySupabase.from('factory_default_prices')
            .select('name, price, unit, sort_order')
            .eq('factory_id', inv.factory_id)
            .order('sort_order', { ascending: true, nullsFirst: false });
        
        if (defaultList && defaultList.length > 0) {
            priceList = defaultList.map(p => ({
                ...p,
                category_name: '기본'
            }));
        }
    }

    // 단가표와 저장된 데이터 병합
    const mergedItems = [];
    if (priceList && priceList.length > 0) {
        priceList.forEach(p => {
            mergedItems.push({
                name: p.name,
                price: Number(p.price || 0),
                qty: savedItemsMap[p.name] || 0,
                category: p.category_name || '기타'
            });
        });
    } else {
        // 둘 다 없는 경우(예외 처리) 그냥 저장된 것만 띄움
        (inv.invoice_items || []).forEach(it => {
            mergedItems.push({
                name: it.name,
                price: Number(it.price || 0),
                qty: Number(it.qty || 0),
                category: '기타'
            });
        });
    }

    const supplyPrice = mergedItems.reduce((s, it) => s + (it.price * it.qty), 0);
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {}, catOrder = [];
        mergedItems.forEach(it => {
            const cat = it.category;
            if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        catOrder.forEach(cat => {
            if (grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:5px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:9px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">품목</th>
                        <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">단가</th>
                        <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">수량</th>
                        <th style="padding:1px 2px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:1px 2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.qty}</td>
                            <td style="padding:1px 2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:5px; font-size:18px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:5px; font-size:12px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid !important; grid-template-columns: repeat(2, 1fr) !important; gap:6px !important; align-items:start !important; padding:3px !important; width: 100% !important;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:10px; padding:10px; border:2px solid #000; text-align:right; font-weight:700; font-size:13px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:5px; margin-bottom:10px; font-size:18px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 5px; color: #0f172a; font-size: 12px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size:12px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${mergedItems.map(it => `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">${it.price.toLocaleString()}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">${it.qty}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">공급가</td>
                        <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">₩ ${supplyPrice.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:10px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};window.calculateAdminDashStats = async function() {
    console.log("DEBUG: Final unified calculateAdminDashStats started");
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    // YYYY-MM
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    const hotelSales = {};

    // 1. 단가제 매출 (invoices)
    const { data: invData } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, hotels(name, contract_type)')
        .eq('factory_id', currentFactoryId);
    
    if(invData) {
        invData.forEach(inv => {
            if (inv.hotels && inv.hotels.contract_type === 'fixed') return;
            const hName = inv.hotels ? inv.hotels.name : '알수없음';
            const supplyPrice = inv.total_amount;
            if(inv.date === todayStr) todayRev += supplyPrice;
            if(inv.date.startsWith(curMonth)) {
                monthRev += supplyPrice;
                hotelSales[hName] = (hotelSales[hName] || 0) + supplyPrice;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += supplyPrice;
        });
    }

    // 2. 정액제 매출 합산
    const { data: hotelData } = await window.mySupabase.from('hotels')
        .select('name, contract_type, fixed_amount, created_at')
        .eq('factory_id', currentFactoryId);
        
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
                const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
                
                if (curMonth >= createdMonth) {
                    monthRev += fixAmt;
                    hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
                }
                if (prevMonthStr >= createdMonth) {
                    prevMonthRev += fixAmt;
                }
            }
        });
    }

    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) {
        let growth = 0;
        if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
        el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    }
    
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) {
        const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
        el4.innerText = `${activeHotels} / ${staffCount || 0}`;
    }

    // Top 10 그리기
    const titleEl = document.getElementById('rankingTitle');
    if (titleEl) titleEl.innerHTML = `${parts[0]}년 ${parts[1]}월 매출 TOP 10`;
    
    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
        rankingArea.innerHTML = sorted.length === 0 ? '<div style="color:gray; padding:10px;">데이터가 없습니다.</div>' : 
            '<table class="admin-table"><thead><tr><th>순위</th><th>거래처명</th><th>이번 달 매출</th></tr></thead><tbody>' + 
            sorted.slice(0, 10).map((f, i) => `<tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right;">${f[1].toLocaleString()}원</td></tr>`).join('') + '</tbody></table>';
    }
    console.log("DEBUG: Final hotelSales after render:", hotelSales);
};

window.updateTrendChartOnly = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // 1. 단가제 매출
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount, hotel_id, hotels!inner(contract_type)').eq('factory_id', currentFactoryId).eq('hotels.contract_type', 'unit');
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += inv.total_amount;
        });
    }
    
    // 2. 정액제 매출
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount, created_at').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
            
            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    if (mKey >= createdMonth) monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                }
            }
            
            if (hotelFilter !== 'all' && h.id === hotelFilter) {
                for (const mKey in monthlyTrend) {
                    if (mKey < createdMonth) monthlyTrend[mKey] = 0;
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};
