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


window.deleteFactory = async function(fId) {
    if(confirm('정말 이 세탁공장을 삭제하시겠습니까? 관련된 모든 데이터(거래처, 명세서)가 연쇄적으로 영구 삭제됩니다!')) {
        const { error } = await window.mySupabase.from('factories').delete().eq('id', fId);
        if (error) { alert('삭제 중 오류가 발생했습니다: ' + error.message); return; }
        
        window.loadSuperAdminDashboard();
        alert('공장이 성공적으로 삭제되었습니다.');
    }
};



window.updateFactoryStatus = async function(fId, s) {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드
 platformData.factories[fId].status = s; saveData(); loadSuperAdminDashboard(); };


window.openFactoryAdminView = function(fId) {
    localStorage.setItem('adminAccessFactoryId', fId);
    let currentPath = window.location.pathname.split('/').pop();
    if (!currentPath || currentPath === '') currentPath = '거래명세서프로그램v37.html';
    window.open(currentPath, '_blank');
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



