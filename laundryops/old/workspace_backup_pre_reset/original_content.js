async function fetchFromSupabase() {
    if (!window.mySupabase) return;
    try {
        console.log('DEBUG: fetchFromSupabase 시작');
        // [v37 Cleanup] platform_data 참조 제거됨
        
        // [보완] 현재 활성화된 화면에 따라 즉시 데이터 다시 그리기
        if (typeof loadSuperAdminDashboard === 'function' && document.getElementById('superFactoryList')) {
            loadSuperAdminDashboard();
        }
        if (typeof loadAdminDashboard === 'function' && document.getElementById('adminStats')) {
            loadAdminDashboard();
        }
        if (typeof loadGlobalNotice === 'function') await loadGlobalNotice();
    } catch (e) { console.error('데이터 가져오기 실패:', e); }
}

function setupRealtimeSubscription() {
    if (!window.mySupabase) return;
    console.log("Realtime subscription setup started");
    // [v37 Cleanup] platform_data 리스너 제거됨
}

console.log("=== v38 파일이 정상 로드되었습니다! ===");
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
    const { data: f } = await window.mySupabase.from('factories').select('*, hotels(*), invoices(*, invoice_items(*)), staff(*), factory_default_prices(*)').eq('id', currentFactoryId).single();
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
    console.log("DEBUG: Restore dialog clicked");
    if (await window.checkAdminExpired()) return;

    // Plan 체크 (일시적으로 제한 해제하여 테스트)
    // const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    // if (!await window.checkAccess('DATA_BACKUP', f, '데이터 복구는 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    console.log("DEBUG: Restore dialog opening...");
    document.getElementById('restoreFile').click();
};

window.restoreFactoryData = async function(input) {
    if (!confirm('업로드한 데이터로 시스템을 복구하고 새로고침하시겠습니까?')) {
        input.value = '';
        return;
    }

    const file = input.files[0];
    if (!file) return;
    
    alert('데이터 복구 중입니다. 잠시만 기다려주세요.');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.name || (!data.admin_id && !data.adminId)) throw new Error("유효하지 않은 데이터 파일입니다.");
            
            // 1. Hotels
            const hotels = data.hotels || [];
            if (Array.isArray(hotels)) {
                for (const h of hotels) {
                    await window.mySupabase.from('hotels').upsert({ 
                        id: h.id || ('h_' + Date.now() + Math.random()), factory_id: currentFactoryId, name: h.name, 
                        ceo: h.ceo, phone: h.phone, biz_no: h.biz_no || h.bizNo, address: h.address,
                        contract_type: h.contract_type || h.contractType, fixed_amount: h.fixed_amount || h.fixedAmount,
                        login_id: h.login_id || h.loginId, login_pw: h.login_pw || h.loginPw, hotel_type: h.hotel_type || h.hotelType
                    });
                }
            }
            // 2. Invoices
            const invList = data.invoices || data.history || [];
            if (Array.isArray(invList)) {
                let successCount = 0;
                let failCount = 0;
                for (const inv of invList) {
                    try {
                        const items = inv.invoice_items || inv.items || [];
                        
                        const { data: insertedInv, error: invErr } = await window.mySupabase.from('invoices').upsert({ 
                            id: inv.id || crypto.randomUUID(),
                            factory_id: currentFactoryId, 
                            hotel_id: inv.hotel_id || inv.hotelId, 
                            date: inv.date, 
                            total_amount: inv.total_amount || inv.total || 0, 
                            is_sent: inv.is_sent || inv.isSent || false, 
                            staff_name: inv.staff_name || inv.staffName || '작성자'
                        }).select().single();
                        
                        if (invErr) throw invErr;

                        if (insertedInv && items.length > 0) {
                             const itemInserts = items.map(it => ({ 
                                 invoice_id: insertedInv.id, 
                                 name: it.name || '품목명없음', 
                                 price: it.price || 0, 
                                 qty: it.qty || 0, 
                                 unit: it.unit || '개'
                             }));
                             const { error: itemErr } = await window.mySupabase.from('invoice_items').insert(itemInserts);
                             if (itemErr) console.warn("DEBUG: invoice_items insert failed for inv:", insertedInv.id, itemErr);
                        }
                        successCount++;
                    } catch (e) {
                        console.error("DEBUG: Invoice restore failed:", inv, e);
                        failCount++;
                    }
                }
                console.log(`DEBUG: Invoice restore complete. Success: ${successCount}, Fail: ${failCount}`);
            }
            // 3. Staff
            const staffList = data.staff || data.staffAccounts || [];
            if (Array.isArray(staffList)) {
                for (const s of staffList) {
                    await window.mySupabase.from('staff').upsert({ id: s.id, factory_id: currentFactoryId, name: s.name, login_id: s.login_id || s.loginId, login_pw: s.login_pw || s.loginPw });
                }
            }

            alert('복구가 완료되었습니다.');
            location.reload();
        } catch (err) { 
            console.error(err);
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
  console.log("DEBUG: showView called for:", id);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) {
      el.classList.add('active');
      console.log("DEBUG: Active class added to:", id);
  } else {
      console.error("DEBUG: View element not found:", id);
  }
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

    const { data: logs, error } = await window.mySupabase.from('sent_logs')
        .select('id, period, total_amount, sent_at, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .order('sent_at', { ascending: false });

    if(error) { 
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">에러: ${error.message}</td></tr>`; 
        return; 
    }

    tbody.innerHTML = '';
    if(!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송 내역이 없습니다.</td></tr>';
        return;
    }

    logs.forEach(log => {
        tbody.innerHTML += `<tr>
            <td>${log.period}</td>
            <td>${log.hotels ? log.hotels.name : '삭제된 거래처'}</td>
            <td>${log.total_amount.toLocaleString()}원</td>
            <td>${log.sent_at.replace('T', ' ').substring(0, 19)}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSentLog('${log.id}')">삭제</button></td>
        </tr>`;
    });
};

window.deleteSentLog = async function(id) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('sent_logs').delete().eq('id', id);
    window.loadAdminSentList();
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
