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
        const { data, error } = await window.mySupabase.from('platform_data').select('data').eq('id', 1).single();
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
        }
    } catch (e) { console.error('데이터 가져오기 실패:', e); }
}

function setupRealtimeSubscription() {
    if (!window.mySupabase) return;
    console.log("Realtime subscription setup started");
    window.mySupabase
      .channel('data_channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_data' }, payload => {
        console.log('클라우드 데이터 변경 감지, 새로고침합니다.');
        fetchFromSupabase();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_data' }, payload => {
        console.log('클라우드 데이터 INSERT 감지, 새로고침합니다.');
        fetchFromSupabase();
      })
      .subscribe();
}

async function initApp() {
    await fetchFromSupabase();
    console.log("Supabase 데이터 로드 시도 완료");
    setupRealtimeSubscription();

    // [복원] 로그인 상태 유지
    const savedFactoryId = localStorage.getItem('currentFactoryId');
    if (savedFactoryId && platformData.factories[savedFactoryId]) {
        currentFactoryId = savedFactoryId;
        // 팩토리 데이터가 로드된 후 뷰 복원
        showView('adminView', platformData.factories[savedFactoryId].name + ' - 대표');
    }
}
window.addEventListener('DOMContentLoaded', initApp);

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
    
    // 1. 저장된 구독 상태가 있으면 우선 반환
    if (factory.subStatus) {
        const statusLabels = { 'active': '활성(사용중)', 'expiring': '만료임박', 'expired': '만료됨', 'trial': '무료체험' };
        return { status: factory.subStatus, label: statusLabels[factory.subStatus] || factory.subStatus };
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

async function saveData() { 
    localStorage.setItem('laundryPlatformV4', JSON.stringify(platformData)); 
    await syncToSupabase(platformData); // [보완] 서버 동기화 완료까지 대기
}
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

window.backupFactoryData = function() {
    const f = platformData.factories[currentFactoryId];
    if (!window.checkAccess('DATA_BACKUP', f, '데이터 백업은 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    if (!confirm('현재 데이터를 백업 파일로 저장하시겠습니까?')) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(f));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `backup_${f.name}_${getTodayString()}.json`);
    dl.click();
};

window.openRestoreDialog = function() {
    const f = platformData.factories[currentFactoryId];
    if (!window.checkAccess('DATA_BACKUP', f, '데이터 복구는 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
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
        // 기존 데이터 조회 (첫 번째 행)
        const { data: existingData, error: fetchError } = await window.mySupabase
            .from('platform_data')
            .select('id')
            .limit(1)
            .single();

        if (existingData) {
            // 기존 데이터가 있으면 해당 ID로 업데이트
            const { error } = await window.mySupabase
                .from('platform_data')
                .update({ data: data })
                .eq('id', existingData.id);
            if (error) console.error('Supabase 업데이트 에러:', error);
        } else {
            // 데이터가 없으면 새로 삽입 (ID 자동 생성)
            const { error } = await window.mySupabase
                .from('platform_data')
                .insert({ data: data });
            if (error) console.error('Supabase 삽입 에러:', error);
        }
    } catch (e) { console.error('동기화 실패:', e); }
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

window.switchTab = async function(el, tabId) {
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
  if(tabId === 'adminStats') window.loadAdminDashboard();
  if(tabId === 'adminHotel') window.loadAdminHotelList();
  if(tabId === 'adminStaff') window.loadAdminStaffList();
  if(tabId === 'adminSent') window.loadAdminSentList();
  if(tabId === 'adminPayment') window.loadAdminPayment();
  
  // 총괄 관리자 탭 추가
  if(tabId === 'superStats') window.loadSuperAdminDashboard();
  if(tabId === 'superFactories') window.loadSuperAdminDashboard();
  if(tabId === 'superPending') window.loadPendingFactories();
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
    const subStatus = window.getSubscriptionStatus(f);
    const planName = f.plan || '라이트';
    
    // 굵고 눈에 띄는 요금제 표시를 위해 HTML 구성
    const htmlContent = `
        <div style="font-size: 24px; font-weight: 900; color: var(--primary); margin-bottom: 5px;">${planName} 요금제</div>
        <div style="font-size: 14px; font-weight: 600; color: var(--secondary);">구독상태: ${subStatus.label} | 만료일: ${f.planExpiry || '제한없음'}</div>
    `;
    
    const subStatusBox = document.getElementById('subStatusBox');
    const modalSubStatusBox = document.getElementById('modalSubStatusBox');
    
    if (subStatusBox) subStatusBox.innerHTML = htmlContent;
    if (modalSubStatusBox) modalSubStatusBox.innerHTML = htmlContent;
};

window.loadAdminSentList = function() {
    const f = platformData.factories[currentFactoryId];
    if(!f || !f.sentInvoices) f.sentInvoices = [];
    const tbody = document.getElementById('adminSentList');
    const searchTerm = document.getElementById('adminSentSearch')?.value.toLowerCase() || '';
    if(!tbody) return;

    // 필터링 및 정렬
    const filteredInvoices = f.sentInvoices.filter(inv =>
        inv.hotelName.toLowerCase().includes(searchTerm) || inv.period.includes(searchTerm)
    ).sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    if(adminSentPage > totalPages && totalPages > 0) adminSentPage = totalPages;

    tbody.innerHTML = '';
    const paginatedInvoices = filteredInvoices.slice((adminSentPage - 1) * itemsPerPage, adminSentPage * itemsPerPage);

    paginatedInvoices.forEach((inv, idx) => {
        const total = (inv.supplyPrice !== undefined && inv.vat !== undefined) ? (inv.supplyPrice + inv.vat) : Math.round(inv.totalAmount * 1.1);
        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
            <td>${inv.hotelName}</td>
            <td>${total.toLocaleString()}원</td>
            <td>${inv.sentAt}</td>
            <td>
                <button class="btn btn-neutral" style="background:var(--primary); color:white; padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.period}', '${inv.sentAt}', false)">내역확인</button>
                <button class="btn btn-neutral" style="background:var(--danger); color:white; padding:4px 8px; font-size:11px;" onclick="deleteSentInvoice('${inv.sentAt}')">삭제</button>
            </td>
        </tr>`;
    });

    // 페이지네이션 컨트롤 (작고 예쁘게 수정)
    const pagination = document.getElementById('adminSentPagination');
    if (pagination) {
        pagination.innerHTML = `
            <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeAdminSentPage(-1)" ${adminSentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                <span style="font-weight: 600; color: #64748b;">${adminSentPage} / ${totalPages || 1}</span>
                <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeAdminSentPage(1)" ${adminSentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
            </div>
        `;
    }
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

// --- Admin Credentials Logic ---
window.saveAdminCredentials = function() {
    const id = document.getElementById('sa_id').value.trim();
    const pw = document.getElementById('sa_pw').value.trim();
    if(!id || !pw) { alert('ID와 비밀번호를 모두 입력하세요.'); return; }
    localStorage.setItem('adminAuth', JSON.stringify({ id, pw }));
    alert('관리자 계정이 변경되었습니다.');
    location.reload();
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
    const isExisting = Object.values(platformData.factories).some(f => f.adminId === regId);
    if(isExisting) { alert('이미 사용 중인 ID입니다.'); return; }
    
    const isPending = Object.values(platformData.pendingFactories || {}).some(p => p.adminId === regId);
    if(isPending) { alert('이미 가입 신청 중인 ID입니다.'); return; }

    if(!platformData.pendingFactories) platformData.pendingFactories = {};
    const reqId = 'req_' + Date.now();
    platformData.pendingFactories[reqId] = {
        name: document.getElementById('reg_name').value.trim(),
        bizNo: document.getElementById('reg_bizNo').value.trim(),
        phone: document.getElementById('reg_phone').value.trim(),
        address: document.getElementById('reg_address').value.trim(),
        adminId: document.getElementById('reg_id').value.trim(),
        adminPw: document.getElementById('reg_pw').value.trim(),
        date: getTodayString()
    };
    saveData(); closeModal('registerModal'); alert('가입 신청이 완료되었습니다! 🐾');
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

// --- Admin Dashboard (with Chart) ---
window.loadAdminDashboard = function() {
  platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };
  const f = platformData.factories[currentFactoryId];
  if(!f) return;

  // [추가] 월별 매출 조회 기본값(현재 월) 설정
  const statsMonth = document.getElementById('adminStatsMonth');
  if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);

  // 구독 배너 처리
  const subStatusLeft = document.getElementById('subStatusLeft');
  const subPlanRight = document.getElementById('subPlanRight');
  const subBanner = document.getElementById('subBanner');
  
  if (subStatusLeft && subPlanRight && subBanner) {
      const subStatus = window.getSubscriptionStatus(f);
      subStatusLeft.innerHTML = `구독상태: ${subStatus.label}`;
      subPlanRight.innerHTML = `요금제: ${f.plan || '라이트'} &nbsp;|&nbsp; 만료일: ${f.planExpiry || '제한없음'}`;
      
      if (subStatus.status === 'expired') subBanner.style.background = '#fee2e2'; // Light red
      else if (subStatus.status === 'expiring') subBanner.style.background = '#fef3c7'; // Light yellow
      else subBanner.style.background = '#dcfce7'; // Light green
  }

  const today = getTodayString();
  const curMonth = document.getElementById('adminStatsMonth')?.value || today.substring(0, 7);
  const filterId = document.getElementById('adminTrendHotelFilter')?.value || 'all';

  let todayRevFiltered = 0; // Today's revenue, filtered by trend filter
  let monthlyRevTotal = 0; // **Total Monthly Revenue for Cards (Should NOT change)**
  let monthlyRevFiltered = 0; // Monthly revenue for trend chart/card (Changes with filter)

  const hotelSalesFiltered = {}; // Used for trend chart filter
  const monthlyTrend = {};
  const allSalesForRanking = {}; // Used for static TOP 5 ranking

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

window.loadAdminRecentInvoices = function(returnList = false) {
    const f = platformData.factories[currentFactoryId], tbody = document.getElementById('adminRecentInvoiceList');
    if(!f) return [];
    const hotelFilter = document.getElementById('adminStatsHotelFilter')?.value || 'all';
    const sDate = document.getElementById('adminStatsStartDate')?.value;
    const eDate = document.getElementById('adminStatsEndDate')?.value;

    let list = (f.history || []).filter(inv => hotelFilter === 'all' || inv.hotelId === hotelFilter);
    if(sDate) list = list.filter(inv => inv.date >= sDate);
    if(eDate) list = list.filter(inv => inv.date <= eDate);

    if(returnList) return list;

    const totalPages = Math.ceil(list.length / itemsPerPage);
    if(currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    if(tbody) {
        tbody.innerHTML = '';
        const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        paginatedList.forEach(inv => {
            const h = f.hotels[inv.hotelId];
            const contractType = h ? (h.contractType === 'fixed' ? '정액' : '단가') : '-';
            const badgeClass = h ? (h.contractType === 'fixed' ? 'badge-fixed' : 'badge-unit') : '';

            tbody.innerHTML += `<tr>
                <td>${inv.date}</td>
                <td><strong>${inv.hotelName}</strong></td>
                <td style="text-align:right;">${inv.total.toLocaleString()}원</td>
                <td><span class="badge ${badgeClass}">${contractType}</span></td>
                <td><span class="badge" style="background:${inv.isSent ? 'var(--success)' : '#cbd5e1'}">${inv.isSent ? '전송완료' : '미전송'}</span></td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:12px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px; margin-left:5px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });

        // 페이지네이션 컨트롤 (작고 예쁘게 수정)
        const paginationContainer = document.getElementById('adminPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = `
                <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                    <span style="font-weight: 600; color: #64748b;">${currentPage} / ${totalPages || 1}</span>
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
                </div>
            `;
        }
    }
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

window.checkSpecialHotelAccess = function(value) {
    if (value === 'special') {
        const f = platformData.factories[currentFactoryId];
        if (!window.checkAccess('SPECIAL_HOTEL', f, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) {
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
        if (!window.checkAccess('SPECIAL_HOTEL', f, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) return;
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

window.openPriceSetting = function(hId) {
    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hId];
    if (h.contractType === 'fixed') {
        alert("정액제 거래처의 거래명세서 내역은 매출 통계에는 집계되지 않습니다.");
    }
    editingHotelId = hId;
    
    // 유형에 따라 분기
    if (h.hotelType === 'special') {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        openModal('priceSettingModal');
        loadHotelCategoryList();
        loadHotelPriceList();
        setTimeout(() => document.getElementById('hp_name').focus(), 100);
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        openModal('simplePriceModal');
        // 윈도우 등에서 거래처 등록 시 누락된 경우를 대비해, 
        // 단가수정 창을 열 때 기본단가가 없다면 공장 기본단가로 다시 채워줍니다.
        if (!h.items || h.items.length === 0) {
            h.items = f.defaultItems ? JSON.parse(JSON.stringify(f.defaultItems)) : [];
            saveData();
        }
        loadSimplePriceList();
    }
};

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

window.addHotelCustomItem = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    const cat = document.getElementById('hp_cat').value;

    if (!name) { alert('품목명 입력!'); return; }
    if (!cat || cat === 'all') { alert('카테고리를 선택해주세요!'); return; }
    if (!h.items) h.items = [];
    h.items.push({ name: name, price: price, unit: unit, category: cat });
    saveData();
    loadHotelPriceList();
    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
    document.getElementById('hp_name').focus();
};

window.loadSimplePriceList = function() {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const tbody = document.getElementById('simplePriceList');
    tbody.innerHTML = '';

    (h.items || []).forEach((item, idx) => {
        tbody.innerHTML += `<tr>
            <td>${item.name}</td>
            <td><input type="number" value="${item.price}" onchange="updateSimpleHotelItemPrice('${item.name}', this.value)"></td>
            <td>${item.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${item.name}')">삭제</button></td>
        </tr>`;
    });
};

window.addSimpleItem = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명 입력!'); return; }
    if (!h.items) h.items = [];
    h.items.push({ name: name, price: price, unit: unit, category: '일반' });
    saveData();
    loadSimplePriceList();
    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
};

window.deleteSimpleItem = function(name) {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    h.items = h.items.filter(i => i.name !== name);
    saveData();
    loadSimplePriceList();
};

window.updateSimpleHotelItemPrice = function(itemName, val) {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const item = h.items.find(i => i.name === itemName);
    if (item) {
        item.price = Number(val);
        saveData();
    }
};

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

window.updateHotelItemPrice = function(itemName, val) {
    const h = platformData.factories[currentFactoryId].hotels[editingHotelId];
    const item = h.items.find(i => i.name === itemName);
    if (item) {
        item.price = Number(val);
        saveData();
    }
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
window.openStaffModal = function() {
  // [추가] 라이트 요금제(레벨 1)일 경우 직원 관리 제한 (비즈니스 이상 필요)
  if (!window.checkAccess('STAFF_MANAGEMENT', null, '라이트 요금제에서 직원등록은 1명 입니다. [요금제 업그레이드] 해주세요')) return;

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
window.loadSuperAdminDashboard = function() {
  console.log("DEBUG: loadSuperAdminDashboard started");
  window.loadPendingFactories();
  const tbody = document.getElementById('superFactoryList');
  if(!tbody) { console.error("DEBUG: superFactoryList tbody not found"); return; }
  tbody.innerHTML = '';
  
  console.log("DEBUG: platformData.factories:", platformData.factories);
  if (!platformData.factories || Object.keys(platformData.factories).length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">공장이 없습니다.</td></tr>';
  }

  const curMonth = document.getElementById('superStatsMonth')?.value || getTodayString().substring(0, 7);
  const searchQuery = document.getElementById('searchFactoryInput')?.value.toLowerCase() || '';

  let totalRev = 0, newFactories = 0, operatingFactories = 0, totalFactories = 0;
  const factorySales = [];

  for(const fId in platformData.factories) {
      const f = platformData.factories[fId];
      totalFactories++;
      if (f.createdAt && f.createdAt.startsWith(curMonth)) newFactories++;

      let monthlyRevenue = 0;
      // 1. 단가제 거래처 매출 합산
      (f.history || []).forEach(inv => {
          if(inv.date.startsWith(curMonth)) monthlyRevenue += inv.total;
      });

      // 2. 정액제 거래처 매출 합산 (미발송 내역 포함)
      for(const hId in (f.hotels || {})) {
          const h = f.hotels[hId];
          if(h.contractType === 'fixed') {
              const hasRecord = (f.history || []).some(inv => inv.hotelId === hId && inv.date.startsWith(curMonth));
              if(!hasRecord) monthlyRevenue += Number(h.fixedAmount || 0);
          }
      }

      totalRev += monthlyRevenue;
      factorySales.push({ name: f.name, revenue: monthlyRevenue });

      if (searchQuery && !f.name.toLowerCase().includes(searchQuery)) continue;

      const subStatus = window.getSubscriptionStatus(f);
      const subBadgeColor = subStatus.status === 'expired' ? '#ef4444' : (subStatus.status === 'expiring' ? '#f59e0b' : '#10b981');
      const subBadge = `<span style="background:${subBadgeColor}; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${subStatus.label}</span>`;
      
      const statusSelect = `<select onchange="updateFactoryStatus('${fId}', this.value)" style="background:${f.status==='suspended'?'#94a3b8':'#00a8e8'}; color:white; border:none; padding:5px; border-radius:4px; font-size:12px;"><option value="operating" ${f.status==='operating'||!f.status?'selected':''}>운영중</option><option value="suspended" ${f.status==='suspended'?'selected':''}>미운영</option></select>`;
      const rowStyle = f.status === 'suspended' ? 'style="background-color: #f1f1f1;"' : '';
      tbody.innerHTML += `<tr ${rowStyle}><td title="${monthlyRevenue.toLocaleString()}원"><strong>${f.name}</strong></td><td>${f.adminId}</td><td>${statusSelect}</td><td>${subBadge}</td><td>${f.plan || '라이트'} / ${f.planExpiry || '-'}</td><td><button class="btn btn-neutral" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="window.viewFactoryDetails('${fId}', true)">수정</button> <button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="window.deleteFactory('${fId}')">삭제</button></td></tr>`;

      if (f.status !== 'suspended') operatingFactories++;
  }

  // Dashboard Metrics
  document.getElementById('superTotalRevenue').innerText = totalRev.toLocaleString() + '원';
  document.getElementById('superNewFactories').innerText = newFactories + '개';
  document.getElementById('superTotalFactories').innerText = operatingFactories + '개';

  // Ranking Top 10
  const rankArea = document.getElementById('superFactoryRankingArea');
  if(rankArea) {
      rankArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
      factorySales.sort((a,b) => b.revenue - a.revenue).slice(0, 10).map((f, i) => `
          <tr><td>${i+1}위</td><td>${f.name}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f.revenue.toLocaleString()}원</td></tr>
      `).join('') + '</tbody></table>';
  }
};
window.loadPendingFactories = function() {
    const tbody = document.getElementById('pendingFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '';
    console.log("DEBUG: loadPendingFactories platformData.pendingFactories:", platformData.pendingFactories);
    if (!platformData.pendingFactories || Object.keys(platformData.pendingFactories).length === 0) {
        console.log("DEBUG: No pending factories found");
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">신청된 데이터가 없습니다.</td></tr>';
    } else {
        console.log("DEBUG: Found pending factories, rendering...");
        for(const reqId in platformData.pendingFactories) {
            const p = platformData.pendingFactories[reqId];
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.bizNo}</td><td>${p.phone}</td><td>${p.address}</td><td><button class="btn btn-save" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="approveFactory('${reqId}')">승인</button><button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="rejectFactory('${reqId}')">반려</button></td></tr>`;
        }
    }
};
window.approveFactory = async function(reqId) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    const p = platformData.pendingFactories[reqId], fId = 'f_' + Date.now();
    
    // 신청일로부터 5개월 뒤 만료일 계산
    const expiryDate = new Date(p.date || new Date());
    expiryDate.setMonth(expiryDate.getMonth() + 5);
    const planExpiry = expiryDate.toISOString().split('T')[0];

    platformData.factories[fId] = { 
        id: fId, 
        name: p.name, 
        adminId: p.adminId, 
        adminPw: p.adminPw, 
        status: 'operating', 
        createdAt: p.date || getTodayString(), 
        subStatus: 'trial',         // 구독상태: 무료체험
        plan: '무료요금제',          // 요금제: 무료요금제
        planExpiry: planExpiry,     // 만료일: 5개월 뒤
        history: [], 
        hotels: {}, 
        staffAccounts: {} 
    };
    delete platformData.pendingFactories[reqId]; saveData(); loadSuperAdminDashboard();
};
window.rejectFactory = async function(reqId) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 if(confirm('반려?')) { delete platformData.pendingFactories[reqId]; saveData(); loadSuperAdminDashboard(); } };
window.updateFactoryStatus = async function(fId, s) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 platformData.factories[fId].status = s; saveData(); loadSuperAdminDashboard(); };
window.deleteFactory = async function(fId) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 if(confirm('삭제?')) { delete platformData.factories[fId]; saveData(); loadSuperAdminDashboard(); } };
window.viewFactoryDetails = function(fId, isSuperAdmin = false) {
    editingFactoryId = fId;
    const f = platformData.factories[fId];
    if(!f) return;
    document.getElementById('s_factoryName').value = f.name;
    document.getElementById('s_adminId').value = f.adminId;
    document.getElementById('s_adminPw').value = f.adminPw;
    document.getElementById('s_ceo').value = f.ceo || '';
    document.getElementById('s_phone').value = f.phone || '';
    document.getElementById('s_address').value = f.address || '';
    document.getElementById('s_bankInfo').value = f.bankInfo || '';
    document.getElementById('s_memo').value = f.memo || '';
    document.getElementById('s_plan').value = f.plan || '라이트';
    document.getElementById('s_planExpiry').value = f.planExpiry || '';
    document.getElementById('s_status').value = f.subStatus || 'active';
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
  document.getElementById('s_plan').value = '라이트';
  document.getElementById('s_status').value = 'active';
  document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
  openModal('factoryModal');
};

window.saveNewFactory = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

  const fields = [{ id: 's_factoryName', err: 'err_s_factoryName' }, { id: 's_adminId', err: 'err_s_adminId' }, { id: 's_adminPw', err: 'err_s_adminPw' }];
  let isValid = true;
  fields.forEach(f => {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.err);
      if (!el.value.trim()) { el.classList.add('error'); if(err) err.style.display = 'block'; isValid = false; } else { el.classList.remove('error'); if(err) err.style.display = 'none'; }
  });
  if (!isValid) return;

  const newId = document.getElementById('s_adminId').value.trim();
  const isDuplicate = Object.values(platformData.factories).some(f => f.adminId === newId && f.id !== editingFactoryId);
  if (isDuplicate) {
      alert('이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.');
      return;
  }

  if (editingFactoryId) {
      const f = platformData.factories[editingFactoryId];
      f.name = document.getElementById('s_factoryName').value.trim();
      f.adminId = document.getElementById('s_adminId').value.trim();
      f.adminPw = document.getElementById('s_adminPw').value.trim();
      f.ceo = document.getElementById('s_ceo').value.trim();
      f.phone = document.getElementById('s_phone').value.trim();
      f.address = document.getElementById('s_address').value.trim();
      f.bankInfo = document.getElementById('s_bankInfo').value.trim();
      f.memo = document.getElementById('s_memo').value.trim();
      f.plan = document.getElementById('s_plan').value;
      f.planExpiry = document.getElementById('s_planExpiry').value;
      f.subStatus = document.getElementById('s_status').value;
  } else {
      const fId = 'f_' + Date.now();
      platformData.factories[fId] = {
          id: fId,
          name: document.getElementById('s_factoryName').value.trim(),
          adminId: document.getElementById('s_adminId').value.trim(),
          adminPw: document.getElementById('s_adminPw').value.trim(),
          ceo: document.getElementById('s_ceo').value.trim(),
          phone: document.getElementById('s_phone').value.trim(),
          address: document.getElementById('s_address').value.trim(),
          bankInfo: document.getElementById('s_bankInfo').value.trim(),
          memo: document.getElementById('s_memo').value.trim(),
          plan: document.getElementById('s_plan').value,
          planExpiry: document.getElementById('s_planExpiry').value,
          subStatus: document.getElementById('s_status').value,
          status: 'operating',
          createdAt: getTodayString(),
          history: [],
          hotels: {},
          staffAccounts: {}
      };
  }
  saveData(); closeModal('factoryModal'); loadSuperAdminDashboard();
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
    
    if (!platformData.pendingPayments) platformData.pendingPayments = [];
    platformData.pendingPayments.push({
        id: 'pay_' + Date.now(),
        factoryId: currentFactoryId,
        factoryName: platformData.factories[currentFactoryId].name,
        plan: selectedPlan,
        months: months,
        total: total,
        requestTaxInvoice: tax,
        depositorName: depositor,
        date: getTodayString()
    });
    saveData();
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

        tbody.innerHTML += `<tr>
            <td>${inv.period}</td>
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

        f.sentInvoices.push({
            sentAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            hotelName: h ? h.name : '알수없음',
            hotelId: hotelId, // 동기화를 위한 ID 추가
            period: sDate + ' ~ ' + eDate,
            totalAmount: totalAmount,
            supplyPrice: supplyPrice,
            vat: vat
        });

        saveData();
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
    console.log("DEBUG: Login triggered");
    
    // [보완] 로그인 시점에 서버 데이터 최신화
    await window.fetchFromSupabase();
    
    // 로컬 데이터 재동기화
    platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {} };

    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    if(!roleEl || !idEl || !pwEl) return;

    // [추가] 필수 입력항목 체크
    const role = roleEl.value;
    if (role === '선택하세요' || !role) {
        alert('역할(세탁공장 대표/현장직원/거래처 파트너)을 선택해주세요.');
        return;
    }
    if (!idEl.value.trim()) {
        alert('ID를 입력해주세요.');
        idEl.focus();
        return;
    }
    if (!pwEl.value.trim()) {
        alert('비밀번호를 입력해주세요.');
        pwEl.focus();
        return;
    }

    const lId = idEl.value.trim();
    const password = pwEl.value.trim(); // PW를 password로 정의

    const adminAuth = JSON.parse(localStorage.getItem('adminAuth')) || { id: 'admin', pw: '1111' };
    
    // Superadmin 먼저 확인
    if (role === 'superadmin' && lId === adminAuth.id && password === adminAuth.pw) {
        showView('superAdminView', '플랫폼 총괄 관리자');
        return;
    }

    if (!platformData || !platformData.factories) {
        alert('데이터 로드 중입니다.');
        return;
    }

    // Role에 따른 로그인 로직 최적화
    let match = null;

    if (role === 'admin') {
        for (const fId in platformData.factories) {
            const f = platformData.factories[fId];
            if (String(f.adminId) === String(lId) && String(f.adminPw) === String(password)) {
                // [신규] 로그인 시 만료일 체크 및 상태 업데이트
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (f.planExpiry) {
                    const expiryDate = new Date(f.planExpiry);
                    // 만료일로부터 1일 이상 지났는지 확인
                    const limitDate = new Date(expiryDate);
                    limitDate.setDate(limitDate.getDate() + 1);

                    if (today >= limitDate) {
                        f.subStatus = 'expired';
                        saveData();
                        setTimeout(() => {
                            const msg = document.getElementById('paymentMsg');
                            if(msg) msg.innerText = "구독상태가 만료 되었습니다. 기능 사용에 제한이 있습니다.";
                            openModal('paymentModal');
                        }, 500);
                    }
                }

                // [추가] 결제 신청 중인지 확인 (알림만 띄우고 진행)
                if (platformData.pendingPayments && platformData.pendingPayments.some(p => p.factoryId === fId)) {
                    alert('입금 내역을 관리자가 확인중입니다.');
                }
                if (f.status === 'suspended') {
                    alert('세탁공장 상태가 미운영 입니다. 관리자에게 문의하십시요');
                    return;
                }
                match = fId;
                break;
            }
        }
        if (match) {
            currentFactoryId = match;
            showView('adminView', platformData.factories[match].name + ' - 대표');
            return;
        }
    } else if (role === 'staff') {
        for (const fId in platformData.factories) {
            const f = platformData.factories[fId];
            if (f.staffAccounts) {
                for (const sId in f.staffAccounts) {
                    if (f.staffAccounts[sId].loginId === lId && f.staffAccounts[sId].loginPw === password) {
                        currentFactoryId = fId;
                        currentStaffName = f.staffAccounts[sId].name;
                        showView('staffView', f.name + ' - 현장직원');
                        loadStaffDashboard();
                        return;
                    }
                }
            }
        }
    } else if (role === 'hotel') {
        for (const fId in platformData.factories) {
            const f = platformData.factories[fId];
            if (f.hotels) {
                for (const hId in f.hotels) {
                    if (f.hotels[hId].loginId === lId && f.hotels[hId].loginPw === password) {
                        currentFactoryId = fId;
                        currentHotelId = hId;
                        showView('hotelView', f.hotels[hId].name);
                        loadHotelDashboard();
                        return;
                    }
                }
            }
        }
    }

    alert('로그인 정보 오류');
};

// 버튼 동작 강제 연결
window.viewFactoryDetails = function(fId, isSuperAdmin = false) {
    console.log("DEBUG: Factory details clicked");
    editingFactoryId = fId;
    const f = platformData.factories[fId];
    if(!f) return;
    
    // 안전한 필드 접근
    const elements = { 
        's_factoryName': f.name, 's_adminId': f.adminId, 's_adminPw': f.adminPw, 
        's_ceo': f.ceo, 's_phone': f.phone, 's_address': f.address, 
        's_bankInfo': f.bankInfo, 's_memo': f.memo, 's_plan': f.plan, 
        's_planExpiry': f.planExpiry, 's_status': f.status, 's_subStatus': f.subStatus 
    };
    Object.keys(elements).forEach(id => { const el = document.getElementById(id); if(el) el.value = elements[id] || ''; });
    
    const container = document.getElementById('admin-only-settings');
    if (container) container.style.display = isSuperAdmin ? 'block' : 'none';
    openModal('factoryModal');
};

window.openFactoryModal = function(isSuperAdmin = false) {
  editingFactoryId = null;
  ['s_factoryName', 's_adminId', 's_adminPw', 's_ceo', 's_phone', 's_address', 's_bankInfo', 's_memo', 's_plan', 's_planExpiry', 's_status', 's_subStatus'].forEach(f => {
      const el = document.getElementById(f);
      if(el) { el.value = ''; el.classList.remove('error'); }
      const err = document.getElementById('err_' + f);
      if(err) err.style.display = 'none';
  });
  
  // 디폴트 설정: 요금제는 "무료요금제", 구독 상태는 "무료체험", 만료일은 5개월 뒤
  document.getElementById('s_plan').value = '무료요금제';
  document.getElementById('s_subStatus').value = 'trial';
  
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 5);
  document.getElementById('s_planExpiry').value = expiryDate.toISOString().split('T')[0];
  
  document.getElementById('s_status').value = 'operating';
  document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
  openModal('factoryModal');
};

window.saveNewFactory = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

  const fields = [{ id: 's_factoryName', err: 'err_s_factoryName' }, { id: 's_adminId', err: 'err_s_adminId' }, { id: 's_adminPw', err: 'err_s_adminPw' }];
  let isValid = true;
  fields.forEach(f => {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.err);
      if (!el.value.trim()) { el.classList.add('error'); if(err) err.style.display = 'block'; isValid = false; } else { el.classList.remove('error'); if(err) err.style.display = 'none'; }
  });
  if (!isValid) return;

  const newId = document.getElementById('s_adminId').value.trim();
  const isDuplicate = Object.values(platformData.factories).some(f => f.adminId === newId && f.id !== editingFactoryId);
  if (isDuplicate) {
      alert('이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.');
      return;
  }

  if (editingFactoryId) {
      const f = platformData.factories[editingFactoryId];
      f.name = document.getElementById('s_factoryName').value.trim();
      f.adminId = document.getElementById('s_adminId').value.trim();
      f.adminPw = document.getElementById('s_adminPw').value.trim();
      f.ceo = document.getElementById('s_ceo').value.trim();
      f.phone = document.getElementById('s_phone').value.trim();
      f.address = document.getElementById('s_address').value.trim();
      f.bankInfo = document.getElementById('s_bankInfo').value.trim();
      f.memo = document.getElementById('s_memo').value.trim();

      f.plan = document.getElementById('s_plan').value;
      f.planExpiry = document.getElementById('s_planExpiry').value;
      f.status = document.getElementById('s_status').value;
      f.subStatus = document.getElementById('s_subStatus').value;
  } else {
      const fId = 'f_' + Date.now();
      platformData.factories[fId] = {
          id: fId,
          name: document.getElementById('s_factoryName').value.trim(),
          adminId: document.getElementById('s_adminId').value.trim(),
          adminPw: document.getElementById('s_adminPw').value.trim(),
          ceo: document.getElementById('s_ceo').value.trim(),
          phone: document.getElementById('s_phone').value.trim(),
          address: document.getElementById('s_address').value.trim(),
          bankInfo: document.getElementById('s_bankInfo').value.trim(),
          memo: document.getElementById('s_memo').value.trim(),
          plan: document.getElementById('s_plan').value,
          planExpiry: document.getElementById('s_planExpiry').value,
          status: document.getElementById('s_status').value,
          subStatus: document.getElementById('s_subStatus').value,
          createdAt: getTodayString(),
          history: [],
          hotels: {},
          staffAccounts: {}
      };
  }
  saveData(); closeModal('factoryModal'); loadSuperAdminDashboard();
};
