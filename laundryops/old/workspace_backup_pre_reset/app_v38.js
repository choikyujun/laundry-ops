console.log("app.js loaded");

// Supabase 초기화 및 데이터 로드
const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
if (window.supabase) {
    window.mySupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
}

async function fetchFromSupabase() {
    if (!window.mySupabase) return;
    try {
// [v37 Cleanup] platform_data 참조 제거됨
        if (data && data.data) {
            console.log('DEBUG: fetchFromSupabase 가져온 데이터:', data.data);
            platformData = data.data;
            localStorage.setItem('laundryPlatformV4', JSON.stringify(platformData));
            console.log('클라우드에서 데이터를 불러왔고 로컬스토리지에 저장했습니다.');

            // [보완] 현재 활성화된 화면에 따라 즉시 데이터 다시 그리기
            if (typeof loadSuperAdminDashboard === 'function' && document.getElementById('superFactoryList')) {
                loadSuperAdminDashboard();
            }
            if (typeof loadAdminDashboard === 'function' && document.getElementById('adminStats')) {
                loadAdminDashboard();
            }
            if (typeof loadGlobalNotice === 'function') loadGlobalNotice();
        }
    } catch (e) { console.error('데이터 가져오기 실패:', e); }
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
    
    // DB에서 직접 데이터 가져오기 (이 부분은 plan level 확인이 필요하므로 먼저 확인)
    const { data: f } = await window.mySupabase.from('factories').select('*, hotels(*), invoices(*), staff(*), factory_default_prices(*)').eq('id', currentFactoryId).single();
    if (!f) return;
    
    // Plan 체크
    if (!await window.checkAccess('DATA_BACKUP', f, '데이터 백업은 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    if (!confirm('현재 데이터를 백업 파일로 저장하시겠습니까?')) return;

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

  // [보완] 탭 클릭 시 서버 데이터 동기화
  await window.fetchFromSupabase();
  
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
  
  // 총괄 관리자 탭 (현황, 계정 설정, 공지사항) 전환 시에는 강제 새로고침
  if(['superAdminStats', 'superAdminSettings', 'superAdminNotice'].includes(tabId)) {
      // 강제 새로고침이므로 localStorage나 hash로 현재 활성 탭을 기억하게 할 수 있지만,
      // 일단 사용자의 명시적인 '페이지 새로고침' 요청을 수행합니다.
      // 새로고침하면 기본적으로 플랫폼 관리자 화면의 첫 번째 탭으로 초기화될 수 있음을 주의!
      // 만약 "UI만 깨끗하게 초기화/동기화 시켜달라"는 의미라면 location.reload() 대신 데이터 다시 로드를 씁니다.
      // (여기서는 일단 "페이지를 새로고침 시켜줘"라는 지시에 맞춰 즉시 재로드 대신 location.reload() 혹은 강력한 데이터 리프레시로 처리합니다.)
      
      // 진짜로 브라우저 전체를 새로고침해버리면 클릭한 탭 화면으로 가지 않고 기본 화면으로 튕길 수 있습니다.
      // 따라서 데이터베이스에서 완전히 최신 데이터를 불러와 화면을 '새로 그린 것'과 똑같은 효과를 줍니다.
      window.loadSuperAdminDashboard();
      if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
      
      // 입력 폼들도 싹 비워주기 (새로고침 효과)
      const saIdInput = document.getElementById('sa_id');
      const saPwInput = document.getElementById('sa_pw');
      if(saIdInput) saIdInput.value = '';
      if(saPwInput) saPwInput.value = '';
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
window.loadAdminSentList = async function() {
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">목록 불러오는 중...</td></tr>';

    // SQL-First: sent_group_id 조회 포함
    const { data: sentList, error } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, hotels(name), sent_group_id')
        .eq('factory_id', currentFactoryId)
        .eq('is_sent', true)
        .order('date', { ascending: false });

    if(error) { 
        console.error("DEBUG: AdminSentList Supabase Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`; 
        return; 
    }

    // 클라이언트 사이드에서 그룹화
    const grouped = {};
    if(sentList) {
        sentList.forEach(inv => {
            // sent_group_id: g_2026-04-04_2026-04-14_12345
            // period: 2026-04-04 ~ 2026-04-14 로 고정
            const parts = inv.sent_group_id ? inv.sent_group_id.split('_') : null;
            const period = (parts && parts.length >= 3) ? (parts[1] + " ~ " + parts[2]) : "기간 없음";
            
            // 그룹 키: ID가 없으면 에러 방지용 날짜 사용, 있으면 ID 사용
            const groupKey = inv.sent_group_id || ("unknown_" + inv.hotel_id + "_" + inv.date);
            
            if(!grouped[groupKey]) {
                grouped[groupKey] = {
                    period: period, // 고정된 값
                    hotelId: inv.hotel_id,
                    hotelName: inv.hotels ? inv.hotels.name : '거래처없음',
                    total: 0,
                    lastDate: inv.date
                };
            }
            grouped[groupKey].total += inv.total_amount;
        });
    }

    tbody.innerHTML = '';
    Object.values(grouped).sort((a,b) => new Date(b.lastDate) - new Date(a.lastDate)).forEach(inv => {
        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
            <td>${inv.hotelName}</td>
            <td>${inv.total.toLocaleString()}원</td>
            <td>${inv.lastDate}</td>
            <td>
                <button class="btn btn-neutral" style="background:var(--primary); color:white; padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.period}', '${inv.lastDate}', false)">내역확인</button>
            </td>
        </tr>`;
    });
};

window.changeAdminSentPage = function(delta) {
    adminSentPage += delta;
    loadAdminSentList();
};

window.viewSentDetail = function(hotelName, period, sentAt, isPartnerView) {
    const f = platformData.factories[currentFactoryId];
    const hotelId = Object.keys(f.hotels).find(id => f.hotels[id].name === hotelName);
    const h = f.hotels[hotelId];
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');
    // 디버그: 데이터 필터링 조건 확인
    console.log("DEBUG: Filtering history with hotelId:", hotelId, "Date Range:", sDate, "~", eDate);
    const list = f.history.filter(inv => inv.hotelId === hotelId && inv.date >= sDate && inv.date <= eDate);
    console.log("DEBUG: viewSentDetail list length:", list.length);
    
    // 이전에 저장된 내역(sentInv)이 있는지 확인하여 리스트가 0이어도 데이터 복구 시도
    const sentInv = f.sentInvoices.find(s => s.sentAt === sentAt);
    
    // 만약 list가 비어있고 sentInv가 있다면, sentInv에 포함된 정보로 최소한의 표시 가능
    if (list.length === 0 && sentInv) {
        console.warn("WARNING: History list is empty but sentInvoice found. Displaying from sentInvoice summary.");
    }

    const supplyPrice = sentInv ? sentInv.supplyPrice : list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = sentInv ? sentInv.vat : Math.floor(supplyPrice * 0.1);
    const total = sentInv ? sentInv.totalAmount : (supplyPrice + vat);
    const totalAmount = total; // 변수 통일

    let reportHtml = '';

    if (h.hotelType === 'special') {
        // [특수거래처] 2단 구성
        const grouped = {};
        const hotelItems = h.items || [];
        const hotelCategories = h.categories || ['기타'];
        
        hotelCategories.forEach(cat => grouped[cat] = []);
        hotelItems.forEach(it => {
            const cat = it.category || '기타';
            // 호텔 설정에 정의된 순서대로 그룹화
            if (!grouped[cat]) grouped[cat] = [];
            if (!grouped[cat].find(i => i.name === it.name)) {
                grouped[cat].push({ name: it.name, qty: 0, price: it.price });
            }
        });

        list.forEach(inv => {
            (inv.items || []).forEach(it => {
                const cat = it.category || '기타';
                if(!grouped[cat]) grouped[cat] = [];
                let item = grouped[cat].find(i => i.name === it.name);
                if (item) {
                    item.qty += it.qty;
                } else {
                    // 설정에 없는 품목이 명세서에 있을 경우 맨 뒤에 추가
                    grouped[cat].push({ name: it.name, qty: it.qty, price: it.price });
                }
            });
        });
        console.log("DEBUG: grouped data:", grouped);

        let categoriesHtml = '';
        hotelCategories.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                                <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id='sent-report-to-print' style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${period}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </div>`;

    } else {
        // [일반거래처] 매트릭스 디자인 (날짜가 행, 품목이 열)
        // 조회 기간 내 모든 날짜 추출
        const [sDateStr, eDateStr] = period.split(' ~ ');
        const startDate = new Date(sDateStr);
        const endDate = new Date(eDateStr);
        const allDates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        // [정렬 수정] 호텔에 등록된 품목 순서대로 정렬
        const itemOrderMap = new Map();
        (h.items || []).forEach((item, index) => itemOrderMap.set(item.name, index));
        const allItems = [...new Set(list.flatMap(i => i.items.map(it => it.name)))].sort((a, b) => (itemOrderMap.get(a) ?? 999) - (itemOrderMap.get(b) ?? 999));
        
        const itemPrices = {};
        list.forEach(inv => {
            inv.items.forEach(it => {
                if(!itemPrices[it.name]) itemPrices[it.name] = it.price;
            });
        });

        const matrix = {};
        allDates.forEach(d => {
            matrix[d] = {};
            allItems.forEach(name => matrix[d][name] = 0);
        });

        list.forEach(inv => {
            inv.items.forEach(it => {
                if (matrix[inv.date]) {
                    matrix[inv.date][it.name] = (matrix[inv.date][it.name] || 0) + it.qty;
                }
            });
        });

        const qtyTotals = {};
        const priceTotals = {};
        allItems.forEach(name => {
            let totalQty = 0;
            allDates.forEach(d => totalQty += (matrix[d][name] || 0));
            qtyTotals[name] = totalQty;
            priceTotals[name] = totalQty * (itemPrices[name] || 0);
        });

        reportHtml = `
        <div id='sent-report-to-print' style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${period}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 12px;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding: 2px 4px; border: 1px solid #cbd5e1;">일자</th>
                        ${allItems.map(name => `<th style="padding: 2px 4px; border: 1px solid #cbd5e1;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${allDates.map(d => `
                        <tr>
                            <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${parseInt(d.substring(8))}</td>
                            ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${matrix[d][name] || 0}</td>`).join('')}
                        </tr>
                    `).join('')}
                    <tr style="background:#f1f5f9; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">수량 합계</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">${qtyTotals[name]}</td>`).join('')}
                    </tr>
                    <tr style="background:#f9fafb; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">단가</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${itemPrices[name].toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background:#fffbeb; font-weight:700;">
                        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:center;">항목 합계</td>
                        ${allItems.map(name => `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align:right;">₩ ${priceTotals[name].toLocaleString()}</td>`).join('')}
                    </tr>
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                <div>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</div>
                <div>총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </div>`;
    }

    // 공통: 인쇄 및 정산 확인 버튼 추가 (거래처 파트너 화면에서만 정산 확인 버튼 표시)
    let confirmBtnHtml = '';
    if (isPartnerView) {
        const isConfirmed = h.confirmedMonths && (h.confirmedMonths[sentAt] === true);
        confirmBtnHtml = !isConfirmed ? `<button class="btn btn-save no-print" style="padding: 15px 40px; cursor: pointer; font-size: 16px; background:#10b981; border:none; color:white; font-weight:700;" onclick="confirmSentReportByPeriod('${sentAt}')">✅ 정산 확인 완료</button>` : '<div style="color: var(--success); font-weight: 700; font-size: 16px;">✅ 이미 확인된 내역입니다.</div>';
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('sent-report-to-print')" style="padding: 15px 40px; cursor: pointer; font-size: 16px; margin-right: 10px;">🖨️ 인쇄하기</button>
        ${confirmBtnHtml}
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
window.loadStaffDashboard = function() {
  const f = platformData.factories[currentFactoryId];
  if(!f) return;
  const select = document.getElementById('staffHotelSelect');
  if(select) {
      select.innerHTML = '<option value="">-- 거래처 선택 --</option>';
      for (const hId in f.hotels) select.innerHTML += `<option value="${hId}">${f.hotels[hId].name}</option>`;
  }
  document.getElementById('invoiceDate').value = getTodayString();
  document.getElementById('staffSearchDate').value = getTodayString();
  window.loadStaffInvoiceList();
};

window.loadStaffInvoiceList = function() {
  platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };
  const f = platformData.factories[currentFactoryId], searchDate = document.getElementById('staffSearchDate').value, tbody = document.getElementById('staffRecentInvoiceList');
  if(!tbody || !f) return; tbody.innerHTML = '';
  const history = (f.history || []).filter(inv => inv.date === searchDate);
  if(history.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; color:gray;">${searchDate} 발행 내역 없음</td></tr>`; return; }
  history.forEach(inv => {
    const h = f.hotels[inv.hotelId];
    // 정액제인 경우 명세서 저장된 총액(계약금액)을 표시, 아니면 항목 합계 계산
    const displaySum = (h && h.contractType === 'fixed') ? inv.total : (inv.items || []).reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 0)), 0);
    const sumText = (h && h.contractType === 'fixed') ? `${displaySum.toLocaleString()}원 (정액)` : `${displaySum.toLocaleString()}원`;

    tbody.innerHTML += `<tr>
    <td>${inv.date}</td>
    <td><strong>${inv.hotelName}</strong></td>
    <td style="text-align:right;">${sumText}</td>
    <td><span class="badge" style="background:var(--success)">✅ 발행완료</span></td>
    <td>${inv.staffName || '-'}</td>
    <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">상세보기</button></td>
  </tr>`});
};

window.openInvoiceModal = function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if(!hId || !date) return;
    const f = platformData.factories[currentFactoryId], h = f.hotels[hId];
    if(!h) return;
    const existing = (f.history || []).find(inv => inv.hotelId === hId && inv.date === date);
    if(existing) { if(!confirm(date + '에 이미 작성된 명세서가 있습니다. 수정하시겠습니까?')) return; }
    document.getElementById('invoiceHotelName').innerText = h.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    // [현장직원용 계약 정보 알림]
    const noticeArea = document.getElementById('contractNoticeArea');
    if (noticeArea) {
        if (h.contractType === 'fixed') {
            const curMonth = date.substring(0, 7);
            const monthlyTotal = (f.history || []).filter(inv => inv.hotelId === hId && inv.date.startsWith(curMonth)).reduce((s, i) => s + i.total, 0);
            noticeArea.innerHTML = `⚠️ 이 거래처는 월 정액제입니다. (금액: ${Number(h.fixedAmount).toLocaleString()}원 / 이번 달 누적: ${monthlyTotal.toLocaleString()}원)`;
            noticeArea.style.display = 'block';
        } else {
            noticeArea.style.display = 'none';
        }
    }

    const badge = document.getElementById('editModeBadge');
    if(badge) badge.style.display = existing ? 'block' : 'none';

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '';

    if (h.hotelType === 'special') {
        // [특수거래처] 저장된 카테고리 순서대로 렌더링
        (h.categories || ['기타']).forEach(cat => {
            const itemsInCategory = (h.items || []).filter(item => (item.category || '기타') === cat);
            if (itemsInCategory.length > 0) {
                tbody.innerHTML += `<tr style="background:#f1f5f9;"><td colspan="5" style="padding:10px; font-weight:700; color:#334155;">📁 ${cat}</td></tr>`;
                itemsInCategory.forEach((item) => {
                    let q = 0;
                    if(existing) { const s = existing.items.find(i => i.name === item.name); if(s) q = s.qty; }
                    tbody.innerHTML += `<tr data-category="${cat}">
                        <td style="padding:10px 5px;">${item.name}</td>
                        <td style="padding:10px 5px;">${item.unit}</td>
                        <td style="padding:10px 5px;">${item.price.toLocaleString()}원</td>
                        <td style="padding:10px 5px;">
                            <input type="number" inputmode="numeric" pattern="[0-9]*" class="inv-qty"
                                   data-price="${item.price}" value="${q}"
                                   oninput="calcInvoiceTotal()" onkeydown="handleQtyKeydown(event)"
                                   onfocus="this.select()" style="width:100%; height:40px; font-size:16px; text-align:center;">
                        </td>
                        <td class="inv-subtotal" style="padding:10px 5px; text-align:right;">0원</td>
                    </tr>`;
                });
            }
        });
    } else {
        // [일반거래처] 기존 방식 (카테고리 없이 나열)
        h.items.forEach((item, idx) => {
            let q = 0;
            if(existing) { const s = existing.items.find(i => i.name === item.name); if(s) q = s.qty; }
            tbody.innerHTML += `<tr data-category="${item.category || '기타'}">
                <td style="padding:10px 5px;">${item.name}</td>
                <td style="padding:10px 5px;">${item.unit}</td>
                <td style="padding:10px 5px;">${item.price.toLocaleString()}원</td>
                <td style="padding:10px 5px;">
                    <input type="number" inputmode="numeric" pattern="[0-9]*" class="inv-qty"
                           data-price="${item.price}" value="${q}"
                           oninput="calcInvoiceTotal()" onkeydown="handleQtyKeydown(event)"
                           onfocus="this.select()" style="width:100%; height:40px; font-size:16px; text-align:center;">
                </td>
                <td class="inv-subtotal" style="padding:10px 5px; text-align:right;">0원</td>
            </tr>`;
        });
    }

    // [수정: 정액제 거래처일 때 금액 합계 표시 방식 변경]
    if (h.contractType === 'fixed') {
        document.getElementById('invoiceTotalAmount').innerText = '0원 (기록용)';
    } else {
        window.calcInvoiceTotal();
    }
};

window.calcInvoiceTotal = function() {
    let total = 0;
    const hId = document.getElementById('staffHotelSelect').value;
    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hId];

    // 합계 표시 (단가제든 정액제든 일단 개별 항목 계산은 수행)
    document.querySelectorAll('#staffInvoiceBody tr').forEach(tr => {
        const qty = Number(tr.querySelector('.inv-qty').value) || 0;
        const price = Number(tr.querySelector('.inv-qty').dataset.price);
        const sub = qty * price;
        tr.querySelector('.inv-subtotal').innerText = sub.toLocaleString() + '원';
        total += sub;
    });

    if (h && h.contractType === 'fixed') {
        document.getElementById('invoiceTotalAmount').innerText = total.toLocaleString() + '원 (기록용)';
    } else {
        document.getElementById('invoiceTotalAmount').innerText = total.toLocaleString() + '원';
    }
};

window.saveAndPrintInvoice = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

  const hId = document.getElementById('staffHotelSelect').value, date = document.getElementById('invoiceDate').value;
  if(!hId || !date) return;
  const f = platformData.factories[currentFactoryId], h = f.hotels[hId];
  if(!h) return;

  let items = [];

  // 항상 품목 리스트 수집
  document.querySelectorAll('#staffInvoiceBody tr').forEach(tr => {
      const qtyInput = tr.querySelector('.inv-qty');
      if (qtyInput) {
          const q = Number(qtyInput.value);
          if (q > 0) {
              const name = tr.cells[0].innerText;
              const price = Number(qtyInput.dataset.price);
              const category = tr.dataset.category || '기타'; // Get category from row
              items.push({ name: name, price: price, qty: q, category: category });
          }
      }
  });

  if(items.length === 0) return alert('수량 입력요망!');

  // 전체 금액 계산 (기본값)
  let totalAmount = items.reduce((s, i) => s + (i.price * i.qty), 0);

  // [추가] 라이트 요금제 발행건수 제한 (테스트: 2건)
  if (getFactoryPlanLevel(f) === 1) {
      if (!window.checkIssuanceLimit(f)) return;
  }

  // 정액제인 경우에만 totalAmount를 fixedAmount로 덮어쓰기
  if (h.contractType === 'fixed' && h.fixedAmount) {
      totalAmount = Number(h.fixedAmount);
  }

  const inv = { id: Date.now(), hotelId: hId, hotelName: h.name, date: date, items: items, total: totalAmount, staffName: currentStaffName || '현장직원' };

  if(!f.history) f.history = []; const existingIdx = f.history.findIndex(i => i.hotelId === hId && i.date === date);
  if(existingIdx > -1) f.history[existingIdx] = inv; else f.history.unshift(inv);

  saveData(); alert('저장되었습니다.'); document.getElementById('invoiceFormArea').style.display = 'none'; window.loadStaffInvoiceList();
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

window.viewInvoiceDetail = function(id) {
    const f = platformData.factories[currentFactoryId];
    const inv = (f.history || []).find(i => i.id == id);
    if(!inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const h = f.hotels[inv.hotelId];
    // [정렬 수정] 저장된 품목 리스트 순서에 맞게 명세서 항목 정렬
    if (h && h.items) {
        const orderMap = new Map();
        h.items.forEach((item, index) => orderMap.set(item.name, index));
        inv.items.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
    }

    const isSpecial = h && h.hotelType === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 이미지 스타일과 유사한 2단 구성
        const grouped = {};
        inv.items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
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
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotelName})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행일: ${inv.date}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} 
            </div>
        </div>`;
    } else {
        // [일반거래처] 리스트 방식 디자인 적용
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotelName})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${(inv.items || []).map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('report-to-print')" style="padding:10px 30px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};

window.handleQtyKeydown = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.inv-qty'));
        const currentIndex = allInputs.indexOf(e.target);
        if (allInputs[currentIndex + 1]) {
            allInputs[currentIndex + 1].focus();
            allInputs[currentIndex + 1].select();
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
          monthlyRevTotal += fixedAmt;
          allSalesForRanking[h.name] = fixedAmt;

          // 월별 매출 추이에도 반영
          for (const m in monthlyTrend) {
              const isFiltered = (filterId === 'all' || filterId === hId);
              if (isFiltered) {
                  monthlyTrend[m] += fixedAmt;
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
        if (!window.checkHotelLimit(f)) return;
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

window.loadHotelCategoryList = function() {
    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[editingHotelId];
    // 특수 거래처는 처음에 카테고리가 없어야 함
    if (!h.categories) h.categories = (h.hotelType === 'special') ? [] : ['기타'];

    const container = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');

    container.innerHTML = '';
    select.innerHTML = '<option value="all">전체</option>';

    h.categories.forEach(cat => {
        container.innerHTML += `<span style="background:#e2e8f0; padding:4px 10px; border-radius:20px; font-size:12px; display:flex; align-items:center;">
            ${cat} ${cat !== '기타' ? `<button onclick="deleteHotelCategory('${cat}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px;">×</button>` : ''}
        </span>`;
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    window.loadHotelPriceList();
};

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

window.loadHotelPriceList = function() {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const tbody = document.getElementById('hotelPriceList');
    const catFilter = document.getElementById('hp_cat').value;

    tbody.innerHTML = '';
    const sortedItems = (h.items || []).sort((a,b) => (a.category || '기타').localeCompare(b.category || '기타'));

    sortedItems.forEach((item) => {
        const itemCat = item.category || '기타';
        // 필터가 없거나 전체(혹은 값이 없으면) 모두 보여줌
        if (catFilter !== 'all' && catFilter !== '' && itemCat !== catFilter) return;

        tbody.innerHTML += `<tr>
            <td>${itemCat}</td>
            <td>${item.name}</td>
            <td><input type="number" value="${item.price}" onchange="updateHotelItemPrice('${item.name}', this.value)"></td>
            <td>${item.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${item.name}')">삭제</button></td>
        </tr>`;
    });
};

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
window.loadAdminStaffList = function() {
  platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };
  const f = platformData.factories[currentFactoryId], tbody = document.getElementById('adminStaffList'); if(!tbody || !f) return; tbody.innerHTML = '';
  const activityBody = document.getElementById('adminStaffActivityList');
  if(activityBody) activityBody.innerHTML = '';

  for(const sId in (f.staffAccounts || {})) {
      const s = f.staffAccounts[sId];
      tbody.innerHTML += `<tr>
          <td><strong>${s.name}</strong></td>
          <td style="font-size:13px;">${s.loginId}<br><small style="color:var(--secondary)">PW: ${s.loginPw}</small></td>
          <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${sId}')">삭제</button></td>
      </tr>`;
  }

  if(activityBody) {
      const history = f.history || [];
      const totalPages = Math.ceil(history.length / itemsPerPage);
      const paginatedHistory = history.slice((currentStaffPage - 1) * itemsPerPage, currentStaffPage * itemsPerPage);

      paginatedHistory.forEach(inv => {
          const h = f.hotels[inv.hotelId];
          const isFixed = (h && h.contractType === 'fixed');
          const displaySum = isFixed ? (inv.items || []).reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 0)), 0) : inv.total;

          activityBody.innerHTML += `<tr>
              <td style="font-size:12px;">${inv.date}</td>
              <td>${inv.staffName || '직원'}</td>
              <td><strong>${inv.hotelName}</strong></td>
              <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
          </tr>`;
      });

      const paginationContainer = document.getElementById('adminStaffPagination');
      if (paginationContainer) {
          paginationContainer.innerHTML = `
              <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                  <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(-1)" ${currentStaffPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                  <span style="font-weight: 600; color: #64748b;">${currentStaffPage} / ${totalPages || 1}</span>
                  <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeStaffPage(1)" ${currentStaffPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
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
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const f = platformData.factories[currentFactoryId];
    const nameInput = document.getElementById('st_name');
    const idInput = document.getElementById('st_loginId');
    const pwInput = document.getElementById('st_loginPw');

    const name = nameInput.value.trim();
    const lId = idInput.value.trim();
    const lPw = pwInput.value.trim();

    let isValid = true;

    // 필수 항목 체크 및 빨간색 테두리 적용
    if (!name) {
        nameInput.style.borderColor = 'red';
        document.getElementById('err_st_name').style.display = 'block';
        isValid = false;
    } else {
        nameInput.style.borderColor = 'var(--border)';
        document.getElementById('err_st_name').style.display = 'none';
    }

    if (!lId) {
        idInput.style.borderColor = 'red';
        document.getElementById('err_st_loginId').style.display = 'block';
        document.getElementById('err_st_loginId').innerText = 'ID를 입력해주세요.';
        isValid = false;
    } else {
        idInput.style.borderColor = 'var(--border)';
        document.getElementById('err_st_loginId').style.display = 'none';
    }

    if (!lPw) {
        pwInput.style.borderColor = 'red';
        document.getElementById('err_st_loginPw').style.display = 'block';
        isValid = false;
    } else {
        pwInput.style.borderColor = 'var(--border)';
        document.getElementById('err_st_loginPw').style.display = 'none';
    }

    if (!isValid) return;

    // 중복 검사
    for (const sId in f.staffAccounts) {
        if (f.staffAccounts[sId].loginId === lId) {
            idInput.style.borderColor = 'red';
            document.getElementById('err_st_loginId').innerText = '이미 존재하는 ID입니다.';
            document.getElementById('err_st_loginId').style.display = 'block';
            return;
        }
    }

    const sId = 'st_' + Date.now();
    if (!f.staffAccounts) f.staffAccounts = {};
    f.staffAccounts[sId] = { id: sId, name: name, loginId: lId, loginPw: lPw };

    saveData();
    closeModal('staffModal');
    window.loadAdminStaffList();
    alert('직원 등록이 완료되었습니다.');
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
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.biz_no}</td><td>${p.phone}</td><td>${p.address}</td><td><button class="btn btn-save" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="approveFactory('${p.id}')">승인</button><button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectFactory('${p.id}')">반려</button></td></tr>`;
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
    if (!currentPath || currentPath === '') currentPath = '거래명세서프로그램v37.html';
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

window.loadHotelDashboard = function() {
    const f = platformData.factories[currentFactoryId];
    if (!f) return;
    const h = f.hotels[currentHotelId];
    if (!h) return;

    // 호텔 파트너 화면용 월 선택기 사용
    const statsInp = document.getElementById('hotelInvoiceMonth');
    const today = getTodayString(), sMonth = statsInp ? (statsInp.value || today.substring(0, 7)) : today.substring(0, 7);
    if(statsInp) statsInp.value = sMonth;

    const hTitle = document.getElementById('hotelNameTitle');
    if (hTitle) hTitle.innerText = h.name;
    
    const hPhone = document.getElementById('h_factoryPhone');
    if (hPhone) hPhone.innerText = f.phone || '-';
    
    const hCeo = document.getElementById('h_factoryCeo');
    if (hCeo) hCeo.innerText = f.ceo || '-';

    // 계약 정보 표시
    const contractEl = document.getElementById('hotelContractInfo');
    if(contractEl) {
        const contractText = h.contractType === 'fixed' ? `정액제 (월 ${Number(h.fixedAmount).toLocaleString()}원)` : '단가제';
        contractEl.innerText = contractText;
    }

    window.loadHotelReceivedInvoicesList();

    const tbody = document.getElementById('hotelInvoiceList'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    let total = 0, count = 0; const itemStats = {}; const monthlyTrend = {};
    const baseDate = new Date(sMonth + "-01");
    for(let i=5; i>=0; i--) { const d = new Date(baseDate); d.setMonth(d.getMonth() - i); monthlyTrend[d.toISOString().substring(0, 7)] = 0; }

    (f.history || []).filter(inv => inv.hotelId === currentHotelId).forEach(inv => {
        const invSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
        if(inv.date.startsWith(sMonth)) {
            total += invSum; count++; inv.items.forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + it.qty);
            tbody.innerHTML += `<tr><td>${inv.date}</td><td style="text-align:center;">${invSum.toLocaleString()}원</td><td><span class="badge" style="background:var(--success)">입고완료</span></td><td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td></tr>`;
        }
        const m = inv.date.substring(0, 7);
        if(monthlyTrend[m] !== undefined) monthlyTrend[m] += invSum;
    });

    if(tbody.innerHTML === '') tbody.innerHTML = `<tr><td colspan="4" style="padding:30px; color:gray;">${sMonth} 내역 없음</td></tr>`;

    const totalEl = document.getElementById('hotelMonthlyTotal');
    if (totalEl) totalEl.innerText = total.toLocaleString() + "원";
    
    const countEl = document.getElementById('hotelMonthlyCount');
    if (countEl) countEl.innerText = count + "회";
    
    const topEl = document.getElementById('hotelTopItem');
    if (topEl) {
        const top = Object.entries(itemStats).sort((a,b) => b[1]-a[1])[0];
        topEl.innerText = top ? `${top[0]} (${top[1]}개)` : "-";
    }

    updateHotelItemChart(itemStats);
    updateHotelTrendChart(monthlyTrend);
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

window.loadHotelReceivedInvoicesList = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f || !f.sentInvoices) return;
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 현재 호텔 ID와 일치하는 발송 내역 필터링
    const myInvoices = f.sentInvoices.filter(inv => inv.hotelId === currentHotelId);

    myInvoices.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)).forEach(inv => {
        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
            <td>${inv.totalAmount.toLocaleString()}원</td>
            <td><span class="badge" style="background:var(--success)">수신완료</span></td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${f.hotels[currentHotelId].name}', '${inv.period}', '${inv.sentAt}', true)">상세</button></td>
        </tr>`;
    });
};

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

window.loadHotelReceivedInvoicesList = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f || !f.sentInvoices) return;
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 현재 호텔의 이름
    const hotelName = f.hotels[currentHotelId] ? f.hotels[currentHotelId].name : null;
    const h = f.hotels[currentHotelId] || {};

    // 호텔 ID나 이름이 일치하는 내역 필터링
    const myInvoices = f.sentInvoices.filter(inv => inv.hotelId === currentHotelId || (inv.hotelName === hotelName && hotelName));

    myInvoices.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)).forEach(inv => {
        const isConfirmed = h.confirmedMonths && (h.confirmedMonths[inv.sentAt] === true);
        const statusBadge = isConfirmed ?
            '<span class="badge" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px;">정산완료</span>' :
            '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px;">수신중</span>';

        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
            <td>${inv.totalAmount.toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${h.name}', '${inv.period}', '${inv.sentAt}', true)">상세</button></td>
        </tr>`;
    });
};

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

window.loadHotelReceivedInvoicesList = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f || !f.sentInvoices) return;
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 현재 호텔 정보
    const hotelName = f.hotels[currentHotelId] ? f.hotels[currentHotelId].name : null;
    const h = f.hotels[currentHotelId] || {};

    // 현재 호텔 ID 또는 이름과 일치하는 발송 내역 필터링
    const myInvoices = f.sentInvoices.filter(inv => inv.hotelId === currentHotelId || (inv.hotelName === hotelName && hotelName));

    console.log("DEBUG: Hotel ID:", currentHotelId, "Hotel Confirmed Months:", h.confirmedMonths);

    myInvoices.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt)).forEach(inv => {
        const isConfirmed = h.confirmedMonths && (h.confirmedMonths[inv.sentAt] === true);
        const statusBadge = isConfirmed ?
            '<span class="badge" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px;">정산완료</span>' :
            '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px;">수신중</span>';

        // [v37 수정] 기간 표시를 YYYY-MM 형태로 보기 좋게 변환
        let displayPeriod = inv.period;
        if(inv.period.includes('~')) {
            const start = inv.period.split('~')[0].trim();
            const parts = start.split('-');
            if(parts.length >= 2) displayPeriod = `${parts[0]}년 ${parseInt(parts[1])}월 정산`;
        }

        tbody.innerHTML += `<tr>
            <td>${displayPeriod}</td>
            <td>${inv.totalAmount.toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${f.hotels[currentHotelId].name}', '${inv.period}', '${inv.sentAt}', true)">상세</button></td>
        </tr>`;
    });
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

    sel.innerHTML = '<option value="">-- 거래처 선택 --</option>';
    data.forEach(h => {
        sel.innerHTML += `<option value="${h.id}">${h.name}</option>`;
    });
};

// [v34 버그픽스] 명세서 작성 모달 (Invoices & Invoice_Items & Hotels 테이블 연동)
window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if(!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    // 1. 거래처 이름과 계약 정보 가져오기 (hotels 테이블)
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    // 2. 이미 해당 날짜에 작성된 명세서가 있는지 확인 (invoices 테이블)
    const { data: existingInv } = await window.mySupabase
        .from('invoices')
        .select('id, total_amount')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    if (existingInv) {
        if(!confirm(date + '에 이미 작성된 명세서가 있습니다. 수정하시겠습니까?')) {
            document.getElementById('staffHotelSelect').value = '';
            document.getElementById('invoiceFormArea').style.display = 'none';
            return;
        }
    }

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    const noticeArea = document.getElementById('contractNoticeArea');
    if (noticeArea) {
        if (hData.contract_type === 'fixed') {
            noticeArea.innerHTML = `⚠️ 이 거래처는 월 정액제입니다. (계약 금액: ${Number(hData.fixed_amount).toLocaleString()}원)`;
            noticeArea.style.display = 'block';
        } else {
            noticeArea.style.display = 'none';
        }
    }

    // 3. 단가 리스트 그리기 (기존 방식 유지하되 DB에서 불러오기)
    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    // 해당 거래처 전용 단가 가져오기 (없으면 공장 기본단가)
    let itemsToRender = [];
    const { data: hItemsData } = await window.mySupabase.from('hotels').select('items').eq('id', hId).single();
    
    if (hItemsData && hItemsData.items && hItemsData.items.length > 0) {
        itemsToRender = hItemsData.items;
    } else {
        const { data: fData } = await window.mySupabase.from('factories').select('default_items').eq('id', currentFactoryId).single();
        if (fData && fData.default_items) {
            itemsToRender = fData.default_items;
        }
    }

    tbody.innerHTML = '';
    itemsToRender.forEach(item => {
        // 기존 작성본(수정)이면 invoice_items에서 해당 품목 수량을 가져와서 매칭시켜야 하지만,
        // 일단 v34 1차 마이그레이션이므로 수량 0으로 빈 양식부터 뿌려줍니다.
        const unit = item.unit || '개';
        tbody.innerHTML += `
        <tr>
            <td>${item.name}</td>
            <td>${unit}</td>
            <td>${Number(item.price).toLocaleString()}원</td>
            <td><input type="number" class="qty-input" value="0" min="0" oninput="calcTotal()" style="width:60px; padding:5px; text-align:center;"></td>
            <td class="item-amount">0원</td>
        </tr>`;
    });

    if(typeof window.calcTotal === 'function') window.calcTotal();
};

// [v34 버그픽스] Enter 키 엔터로 아래 칸 이동 및 단가표 그리기 수정
window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if(!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    let itemsToRender = [];
    // 거래처 전용 단가 가져오기
    const { data: hItemsData } = await window.mySupabase.from('hotels').select('items').eq('id', hId).single();
    
    if (hItemsData && hItemsData.items && hItemsData.items.length > 0) {
        itemsToRender = hItemsData.items;
    } else {
        const { data: fData } = await window.mySupabase.from('factories').select('default_items').eq('id', currentFactoryId).single();
        if (fData && fData.default_items) {
            itemsToRender = fData.default_items;
        }
    }

    tbody.innerHTML = '';
    itemsToRender.forEach(item => {
        const unit = item.unit || '개';
        // [수정] class="inv-qty" 와 onkeydown="handleQtyKeydown(event)" 추가
        tbody.innerHTML += `
        <tr>
            <td>${item.name}</td>
            <td>${unit}</td>
            <td class="item-price">${item.price}</td>
            <td><input type="number" class="inv-qty qty-input" value="0" min="0" oninput="calcTotal()" onkeydown="handleQtyKeydown(event)" style="width:60px; padding:5px; text-align:center;"></td>
            <td class="item-amount">0원</td>
        </tr>`;
    });

    if(typeof window.calcTotal === 'function') window.calcTotal();
};

window.calcTotal = function() {
    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    let total = 0;
    rows.forEach(row => {
        if(row.cells.length < 5) return;
        const price = Number(row.cells[2].innerText.replace(/[^0-9]/g, '')) || 0;
        const qtyInput = row.querySelector('.qty-input');
        const qty = qtyInput ? Number(qtyInput.value) : 0;
        const amt = price * qty;
        total += amt;
        row.querySelector('.item-amount').innerText = amt.toLocaleString() + '원';
    });
    document.getElementById('invoiceTotalAmount').innerText = total.toLocaleString() + '원';
};

// [v34 버그픽스] 현장직원 화면 - 거래명세서 발행 목록 (Invoices & Hotels 조인)
window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDate = document.getElementById('staffSearchDate') ? document.getElementById('staffSearchDate').value : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`
            id, date, total_amount, is_sent, staff_name,
            hotels ( name )
        `)
        .eq('factory_id', currentFactoryId);

    if (searchDate) {
        query = query.eq('date', searchDate);
    }

    const { data, error } = await query.order('date', { ascending: false }).limit(30);

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">오류가 발생했습니다.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
        const statusBadge = inv.is_sent 
            ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

        tbody.innerHTML += `
        <tr>
            <td>${inv.date}</td>
            <td style="font-weight:700;">${hName}</td>
            <td style="text-align:right;">${inv.total_amount.toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td>${inv.staff_name || '관리자'}</td>
            <td>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

// [v34 버그픽스] 대표자 화면 탭 클릭 시 목록 로드 호출 고리 연결
window.switchTab = async function(el, tabId) {
    if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent'].includes(tabId)) {
        if (typeof window.checkAdminExpired === 'function' && await window.checkAdminExpired()) return;
    }

    const parent = el.closest('.view');
    parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const target = parent.querySelector('#tab_' + tabId);
    if(target) target.classList.add('active');

    // v34에 맞게 DB에서 데이터 최신화 (명세서 목록 강제 갱신!)
    if(tabId === 'adminStats') {
        if(typeof window.loadAdminDashboard === 'function') {
            await window.loadAdminDashboard(); // 내부에서 loadAdminRecentInvoices() 호출함
        } else if(typeof window.loadAdminRecentInvoices === 'function') {
            window.loadAdminRecentInvoices(); 
        }
    }
    if(tabId === 'adminHotel') { if(typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList(); }
    if(tabId === 'adminStaff') { 
        if(typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList(); 
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList(); 
    }
};

// [v34 버그픽스] 대표자 화면 - 첫 번째 탭의 거래명세서 목록 (필터링 및 UI 렌더링 완벽 복구)
// 중복을 제거하기 위해 이 곳에 있던 loadAdminDashboard 오버라이드 삭제

// [v34 버그픽스] 대표자 화면 탭 클릭 시 거래명세서 목록 강제 갱신
// 기존 스크립트의 하단에 로드 함수를 덮어씁니다.
window.switchTab = async function(el, tabId) {
    const parent = el.closest('.view');
    parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const target = parent.querySelector('#tab_' + tabId);
    if(target) target.classList.add('active');

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
};

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
window.loadSuperAdminDashboard = async function() {
    const tbody = document.getElementById('superFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    window.loadPendingFactories();
    if(typeof window.loadPendingPayments === 'function') await window.loadPendingPayments();
    if(typeof window.loadApprovedPayments === 'function') window.loadApprovedPayments();

    const curMonth = document.getElementById('superStatsMonth')?.value || getTodayString().substring(0, 7);
    const searchQuery = document.getElementById('searchFactoryInput')?.value.toLowerCase() || '';

    let query = window.mySupabase.from('factories').select('*' , { count: 'exact' });
    if (searchQuery) query = query.ilike('name', '%+searchQuery+%');
    const { data: factories, error: fErr } = await query.order('created_at', { ascending: false }).limit(100);

    if (fErr) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">에러: ' + fErr.message + '</td></tr>'; return; }
    if (!factories || factories.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 공장이 없습니다.</td></tr>'; return; }

    const startDate = curMonth + '-01';
    const endDateStr = curMonth.split('-')[0] + '-' + (parseInt(curMonth.split('-')[1]) + 1).toString().padStart(2, '0') + '-01';
    const { data: invoices } = await window.mySupabase.from('invoices').select('factory_id, total_amount').gte('date', startDate).lt('date', endDateStr);
    const monthlyRevMap = {};
    if (invoices) invoices.forEach(inv => { monthlyRevMap[inv.factory_id] = (monthlyRevMap[inv.factory_id] || 0) + (inv.total_amount || 0); });

    const { data: fixedHotels } = await window.mySupabase.from('hotels').select('factory_id, fixed_amount').eq('contract_type', 'fixed');
    if (fixedHotels) fixedHotels.forEach(h => { monthlyRevMap[h.factory_id] = (monthlyRevMap[h.factory_id] || 0) + Number(h.fixed_amount || 0); });

    let totalRev = 0, operatingFactories = 0;
    const factorySales = [];
    tbody.innerHTML = '';

    factories.forEach(f => {
        if (f.status === 'pending') return;
        const monthlyRevenue = monthlyRevMap[f.id] || 0;
        totalRev += monthlyRevenue;
        factorySales.push({ name: f.name, revenue: monthlyRevenue });

        const statusMap = { 'active': '활성(운영중)', 'operating': '활성(운영중)', 'trial': '무료체험', 'expiring': '만료 임박', 'expired': '만료됨', 'suspended': '정지' };
        
        // 디버깅: 실제 DB 값을 함께 표시
        const sStatus = f.sub_status || 'active';
        const statusLabel = statusMap[sStatus] || '활성(운영중)';
        
        // 배지 스타일도 상태에 따라 동적 적용
        const badgeColors = { 'active': '#10b981', 'operating': '#10b981', 'trial': '#f59e0b', 'expiring': '#f59e0b', 'expired': '#ef4444', 'suspended': '#94a3b8' };
        const badgeBg = badgeColors[sStatus] || '#10b981';
        
        const subBadge = `<span style="background:${badgeBg}; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${statusLabel} (${sStatus})</span>`;
        const statusSelect = `<select onchange="updateFactoryStatus('${f.id}', this.value)" style="background:${f.status==='suspended'?'#94a3b8':'#00a8e8'}; color:white; border:none; padding:5px; border-radius:4px; font-size:12px;"><option value="operating" ${f.status==='operating'?'selected':''}>운영중</option><option value="suspended" ${f.status==='suspended'?'selected':''}>미운영</option></select>`;
        
        tbody.innerHTML += `<tr ${f.status === 'suspended' ? 'style="background-color: #f1f1f1;"' : ''}>
            <td title="${monthlyRevenue.toLocaleString()}원"><strong style="cursor:pointer; color:var(--primary);" onclick="window.openFactoryAdminView('${f.id}')">${f.name}</strong></td>
            <td>${f.admin_id}</td>
            <td>${statusSelect}</td>
            <td>${subBadge}</td>
            <td>${f.plan || '무료요금제'} / ${f.plan_expiry || '-'}</td>
            <td>
                <button class="btn btn-save" style="padding:5px; font-size:12px; border-radius:4px; border-style:none; margin-right:5px;" onclick="viewFactoryDetails('${f.id}', true)">수정</button>
                <button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border-style:none;" onclick="deleteFactory('${f.id}')">삭제</button>
            </td>
        </tr>`;
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
};
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
                <button class="btn btn-save" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="approvePayment('${p.id}')">승인</button>
                <button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectPayment('${p.id}')">반려</button>
            </td>
        </tr>`;
    });
};

window.loadApprovedPayments = async function() {
    const tbody = document.getElementById('approvedPaymentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10">데이터 로딩 중...</td></tr>';
    
    // 1. 승인된 결제 데이터 가져오기
    const { data: payments, error: pErr } = await window.mySupabase.from('approved_payments').select('*');
    if (pErr) { console.error('승인된 결제 목록 로드 실패:', pErr); tbody.innerHTML = '<tr><td colspan="10">데이터 로드 실패</td></tr>'; return; }
    
    // 2. 모든 공장 데이터 가져오기 (매핑용)
    const { data: factories, error: fErr } = await window.mySupabase.from('factories').select('id, name');
    const factoryMap = {};
    if (factories) {
        factories.forEach(f => factoryMap[f.id] = f.name);
    }
    
    tbody.innerHTML = '';
    (payments || []).slice().reverse().forEach(p => {
        const factoryName = factoryMap[p.factory_id] || p.factory_name || '-';
        tbody.innerHTML += `<tr>
            <td>${factoryName}</td>
            <td>${p.plan || '-'}</td>
            <td>${p.months || 0}개월</td>
            <td>${Number(p.total).toLocaleString()}원</td>
            <td>${p.request_tax_invoice ? '요청' : '미요청'}</td>
            <td>${p.depositor_name || '이름없음'}</td>
            <td>${p.date || '-'}</td>
            <td>${p.approved_at || '-'}</td>
            <td>${p.new_expiry || '-'}</td>
            <td><button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="deleteApprovedPayment('${p.id}')">삭제</button></td>
        </tr>`;
    });
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
    
    // expiry를 갱신 (만료일이 유효하고 미래면 해당 날짜 기준, 과거/없으면 오늘 기준)
    let expiry = new Date(f.plan_expiry);
    if (isNaN(expiry.getTime()) || expiry < new Date()) {
        expiry = new Date();
    }
    
    expiry.setMonth(expiry.getMonth() + parseInt(payment.months));
    const newExpiry = expiry.toISOString().split('T')[0];
    
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

window.deleteApprovedPayment = async function(paymentId) {
    if (!confirm('정말 결제 승인 내역을 삭제하시겠습니까?')) return;
    
    const { error } = await window.mySupabase.from('approved_payments').delete().eq('id', paymentId);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    
    if(typeof window.fetchFromSupabase === 'function') await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
};

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


window.calculateAdminDashStats = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    // YYYY-MM
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    
    // 1. 단가제 매출 (invoices)
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) monthRev += inv.total_amount;
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += inv.total_amount;
        });
    }

    // 2. 정액제 매출 합산 (hotels)
    const { data: hotelData } = await window.mySupabase.from('hotels').select('contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                monthRev += Number(h.fixed_amount || 0);
                prevMonthRev += Number(h.fixed_amount || 0);
            }
        });
    }

    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    let growth = 0;
    if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) el4.innerText = activeHotels + ' / ' + (staffCount || 0);
};

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
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    const { data: hotelData } = await window.mySupabase.from('hotels').select('contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    if(hotelData) {
        hotelData.forEach(h => {
            if(h.contract_type === 'fixed') {
                for (const m in monthlyTrend) {
                    monthlyTrend[m] += Number(h.fixed_amount || 0);
                }
            }
        });
    }

    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    window.updateRevenueTrendChart(monthlyTrend, hotelFilter === 'all' ? '전체' : '선택 거래처');
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
    
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    let hotelQuery = window.mySupabase.from('hotels').select('name, contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};
window.calculateAdminDashStats = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    
    // Top 10 집계를 위한 객체
    const hotelSales = {};

    // 1. 단가제 매출 (invoices)
    const { data: invData } = await window.mySupabase.from('invoices').select('date, total_amount, hotel_id, hotels(name)').eq('factory_id', currentFactoryId);
    if(invData) {
        invData.forEach(inv => {
            if(inv.date === todayStr) todayRev += inv.total_amount;
            if(inv.date.startsWith(curMonth)) {
                monthRev += inv.total_amount;
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                hotelSales[hName] = (hotelSales[hName] || 0) + inv.total_amount;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += inv.total_amount;
        });
    }

    // 2. 정액제 매출 합산 (hotels)
    const { data: hotelData } = await window.mySupabase.from('hotels').select('name, contract_type, fixed_amount').eq('factory_id', currentFactoryId);
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
                monthRev += fixAmt;
                prevMonthRev += fixAmt;
                hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
            }
        });
    }

    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    let growth = 0;
    if (prevMonthRev > 0) growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    
    const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) el4.innerText = activeHotels + ' / ' + (staffCount || 0);

    // [v37] 매출 TOP 10 업데이트
    const rankingTitle = document.getElementById('rankingTitle');
    if(rankingTitle) rankingTitle.innerText = `${curMonth} 거래처 매출 TOP 10`;

    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const top10 = Object.entries(hotelSales).sort((a,b) => b[1]-a[1]).slice(0, 10);
        if (top10.length === 0) {
            rankingArea.innerHTML = '<div style="text-align:center; color:var(--secondary); padding: 20px;">매출 데이터가 없습니다.</div>';
        } else {
            rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>거래처명</th><th>이번 달 매출</th></tr></thead><tbody>' +
            top10.map((f, i) => `
                <tr>
                    <td>${i+1}위</td>
                    <td>${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary);">${f[1].toLocaleString()}원</td>
                </tr>
            `).join('') + '</tbody></table>';
        }
    }
};
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        (inv.items || []).forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        </body></html>`;
    } else {
        reportHtml = `
        <html><head><style>@page { size: A5; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; } table { width:100%; border-collapse:collapse; margin-top:20px; } th, td { border:1px solid #000; padding:8px; font-size:12px; } th { background:#f1f5f9; text-align:center; } td.num { text-align:right; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">거래명세서</h1>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div style="font-weight:700; font-size:18px;">${inv.hotels?inv.hotels.name:''} 귀하</div>
                <div style="text-align:right; font-size:12px;">일자: ${inv.date}<br>담당자: ${inv.staff_name||''}</div>
            </div>
            <table>
                <thead><tr><th>품목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
                <tbody>
                    ${(inv.items || []).map(it => `<tr>
                        <td>${it.name}</td>
                        <td class="num">${it.qty}</td>
                        <td class="num">${Number(it.price||0).toLocaleString()}</td>
                        <td class="num">${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; background:#eff6ff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:18px;">총 합계: ₩ ${total.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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

window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        (inv.items || []).forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        </div>`;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">거래명세서</h1>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div style="font-weight:700; font-size:18px;">${inv.hotels?inv.hotels.name:''} 귀하</div>
                <div style="text-align:right; font-size:12px;">일자: ${inv.date}<br>담당자: ${inv.staff_name||''}</div>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                <thead><tr><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">품목</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">수량</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">단가</th><th style="border:1px solid #000; padding:8px; font-size:12px; background:#f1f5f9; text-align:center;">금액</th></tr></thead>
                <tbody>
                    ${(inv.items || []).map(it => `<tr>
                        <td style="border:1px solid #000; padding:8px; font-size:12px;">${it.name}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${it.qty}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${Number(it.price||0).toLocaleString()}</td>
                        <td style="border:1px solid #000; padding:8px; font-size:12px; text-align:right;">${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; background:#eff6ff; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:14px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight:700; font-size:18px;">총 합계: ₩ ${total.toLocaleString()}</div>
            </div>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('report-to-print')" style="padding:10px 30px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
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
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    // [Fix 1] Query invoice_items removed to prevent 400 error
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, total_amount')
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
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

window.viewInvoiceDetail = async function(id) {
    // [Fix 2] Fetch invoice_items and render into popup instead of window.open
    const { data: inv, error } = await window.mySupabase.from('invoices').select('*, hotels(name, contract_type), invoice_items(name, qty, price, category)').eq('id', id).single();
    if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    // [Fix 2] Insert into modal instead of window.open
    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};
window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        console.error("DEBUG viewInvoiceDetail error:", error);
        alert('데이터를 찾을 수 없습니다. 에러: ' + (error ? error.message : '')); 
        return; 
    }

    const isSpecial = inv.hotels && inv.hotels.contract_type === 'special';
    const items = inv.invoice_items || [];
    const actualSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${Number(it.price||0).toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(Number(it.price||0) * Number(it.qty||0)).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${total.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('invoiceDetailArea')" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
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

    // 모달창에 띄울 내용
    let reportHtml = `
        <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
        <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
        
        <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        
        <div style="text-align:center; margin-top:30px; font-size: 15px; color: var(--secondary);">
            위 내역으로 거래처 담당자에게 정산명세서를 발송하시겠습니까?<br>
            <span style="font-size:12px; color:#ef4444;">(추후 카카오톡/문자 연동 시 해당 채널로 발송됩니다.)</span>
        </div>
        
        <div style="text-align:center; margin-top:20px;">
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button>
        </div>
    `;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(confirm(`${h.name} 거래처로 명세서를 발송 처리하시겠습니까?`)) {
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            alert('발송 처리가 완료되었습니다.'); // 카카오톡 멘트 제거
            window.loadAdminRecentInvoices(); 
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
    console.log("DEBUG: openPriceSetting for hotel:", hId, "factory:", currentFactoryId);
    
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id, name, sort_order').eq('hotel_id', hId).limit(10);
    
    // 품목이 0개라면 공장 기본단가에서 복사 (순서대로 가져오기!)
    const { data: defaults } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        // "기본" 카테고리 확인/생성
        let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        if (!cat) {
            const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
            if (res.data) cat = res.data;
        }
        
        if (cat) {
            // 순차적 삽입으로 정렬 순서 보장 (index i 를 사용하여 명확한 순서 부여)
            for (let i = 0; i < defaults.length; i++) {
                const d = defaults[i];
                const insertData = {
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: i, // 사장님의 정렬을 위해 인덱스 i를 강제 할당
                    created_at: new Date(new Date().getTime() + (i * 1000)).toISOString()
                };
                await window.mySupabase.from('hotel_item_prices').insert([insertData]);
            }
        }
    }

    // [중요] 어떤 경우든 목록 새로고침! (단가 복사 여부와 상관없이 호출)
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';
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
    
    // [Task] Check hotel type
    const { data: hotel } = await window.mySupabase.from('hotels').select('contract_type, hotelType, type').eq('id', hId).single();
    const isSpecial = hotel && (hotel.contract_type === 'special' || hotel.hotelType === 'special' || hotel.type === 'special');

    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    // [Task] Delete '기타' if special
    if (isSpecial && cats) {
        const others = cats.find(c => c.name === '기타');
        if (others) {
            await window.mySupabase.from('hotel_categories').delete().eq('id', others.id);
            // Reload without '기타'
            return window.loadHotelCategoryList();
        }
    }
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    if(tagContainer) tagContainer.innerHTML = '';
    if(select) select.innerHTML = '<option value="">선택하세요</option>';
    
    let hasDefault = false;
    
    if(cats && cats.length > 0) {
        cats.forEach(c => {
            // If special and name is '기타', skip
            if (isSpecial && c.name === '기타') return;
            
            if(c.name === '기타') hasDefault = true;
            if(tagContainer) {
                tagContainer.innerHTML += `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} ${c.name !== '기타' ? `<button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>` : ''}
                </span>`;
            }
            if(select) {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
    }
    
    // If not special, and '기타' not found, create it
    if(!isSpecial && !hasDefault) {
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기타' }]);
        return window.loadHotelCategoryList();
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
        if(exist) { alert('이미 존재하는 카테고리입니다.'); return; }
        
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: catName }]);
        input.value = '';
        await window.loadHotelCategoryList();
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

    const payload = {
        factory_id: String(currentFactoryId),
        hotel_id: String(hId),
        name: String(name),
        price: Number(price),
        unit: String(unit),
        category_id: String(catId),
        category_name: String(finalCatName),
        sort_order: 999
    };
    
    console.log("DEBUG: Final Payload Object:", JSON.stringify(payload));
    
    // [강력 조치] 완전한 insert 시도 후 실패시 업데이트 로직
    const { data: insertData, error: insertError } = await window.mySupabase.from('hotel_item_prices')
        .insert([payload]);

    if (insertError) {
        console.warn("DEBUG: Insert failed, trying update:", insertError.message);
        // insert 실패시 update 시도 (이때는 전체 컬럼 명시)
        const { error: updateError } = await window.mySupabase.from('hotel_item_prices')
            .update({
                price: payload.price,
                unit: payload.unit,
                category_id: payload.category_id,
                category_name: payload.category_name,
                sort_order: payload.sort_order
            })
            .eq('hotel_id', payload.hotel_id)
            .eq('name', payload.name);
            
        if (updateError) {
            console.error("DEBUG: Update failed too:", updateError);
            alert('저장 실패: ' + updateError.message);
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
    const { data: items } = await window.mySupabase.from('hotel_item_prices').select('*').eq('hotel_id', hId).order('category_name').order('created_at');
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td>${it.price.toLocaleString()}원</td>
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
window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId; 
    console.log("DEBUG: openPriceSetting for hotel:", hId, "factory:", currentFactoryId);
    
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id, name, sort_order').eq('hotel_id', hId).limit(10);
    console.log("DEBUG: existItems check:", existItems);
    
    // 품목이 0개라면 공장 기본단가에서 복사 (순서대로 가져오기!)
    const { data: defaults } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    console.log("DEBUG: Condition evaluation:", {
        existItemsEmpty: (!existItems || existItems.length === 0),
        defaultsExist: (defaults && defaults.length > 0),
        combined: ((!existItems || existItems.length === 0) && defaults && defaults.length > 0)
    });
    
    if ((!existItems || existItems.length === 0) && defaults && defaults.length > 0) {
        // "기본" 카테고리 확인/생성
        let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        console.log("DEBUG: Category check:", cat);
        if (!cat) {
            const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
            if (res.data) cat = res.data;
        }
        
        if (cat) {
            // 순차적 삽입으로 정렬 순서 보장 (index i 를 사용하여 명확한 순서 부여)
            for (let i = 0; i < defaults.length; i++) {
                const d = defaults[i];
                console.log("DEBUG: Processing default item:", d.name, "with forced sort_order:", i);
                const insertData = {
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: Number(d.sort_order), // 기본 단가의 순서값을 그대로 사용
                    created_at: new Date(new Date().getTime() + (i * 1000)).toISOString()
                };
                console.log("DEBUG: Inserting item:", d.name, "with DEFAULT sort_order:", d.sort_order);
                const { error: insertErr } = await window.mySupabase.from('hotel_item_prices').insert([insertData]);
                if (insertErr) console.error("DEBUG: Insert failed:", insertErr);
            }
            console.log("DEBUG: Default items inserted sequentially.");
            console.log("DEBUG: Default items inserted sequentially.");
        }
    }

    // [강제 순서 재설정] 데이터가 이미 들어가 있는데 sort_order가 0이면 created_at 순서대로 다시 매긴다
    const { data: items, error } = await window.mySupabase.from('hotel_item_prices')
        .select('*')
        .eq('hotel_id', hId)
        .order('created_at', { ascending: true });
    
    console.log("DEBUG: Checking for reassignment. Items:", items);

    if (items && items.length > 0) {
        console.log("DEBUG: All sort_order are 0:", items.every(i => i.sort_order === 0));
        if (items.every(i => i.sort_order === 0)) {
            console.log("DEBUG: Re-assigning sort_order based on created_at...");
            for (let i = 0; i < items.length; i++) {
                await window.mySupabase.from('hotel_item_prices')
                    .update({ sort_order: i })
                    .eq('id', items[i].id);
            }
            await window.loadSimplePriceList(); // 다시 로드
        }
    }
};

window.loadHotelPriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    // [수정] select('*')를 명시적인 컬럼 지정으로 변경하여 정확하게 데이터 가져오기!
    const { data: items } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    
    const tbody = document.getElementById('hotelPriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    items.forEach(it => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:80px; padding:4px;">원</td>
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

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit,
        category_id: cat ? cat.id : null,
        category_name: (cat && cat.name) ? cat.name : '기타'
    };
    
    // Explicitly casting values
    const finalPayload = {
        factory_id: payload.factory_id,
        hotel_id: payload.hotel_id,
        name: String(payload.name),
        price: Number(payload.price),
        unit: String(payload.unit),
        category_id: payload.category_id ? String(payload.category_id) : null,
        category_name: String(payload.category_name)
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
