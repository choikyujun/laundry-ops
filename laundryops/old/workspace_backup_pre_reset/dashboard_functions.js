
window.loadSuperAdminDashboard = async function() {
  // platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {}, pendingPayments: [] };
  console.log("DEBUG: platformData loaded:", platformData);
  window.loadPendingFactories();
  await window.loadPendingPayments();
  await window.loadApprovedPayments();
  const tbody = document.getElementById('superFactoryList');
  if(!tbody) return;
  tbody.innerHTML = '';

  const curMonth = document.getElementById('superStatsMonth')?.value || getTodayString().substring(0, 7);
  const searchQuery = document.getElementById('searchFactoryInput')?.value.toLowerCase() || '';

  let totalRev = 0, newFactories = 0, operatingFactories = 0;
  const factorySales = [];

  for(const fId in platformData.factories) {
      const f = platformData.factories[fId];
      if (!f) continue; // 데이터 무결성 체크
      if (f.createdAt && f.createdAt.startsWith(curMonth)) newFactories++;

      let monthlyRevenue = 0;
      (f.history || []).forEach(inv => {
          if(inv.date && inv.date.startsWith(curMonth)) monthlyRevenue += (inv.total || 0);
      });

      for(const hId in (f.hotels || {})) {
          const h = f.hotels[hId];
          if(h && h.contractType === 'fixed') {
              const hasRecord = (f.history || []).some(inv => inv.hotelId === hId && inv.date && inv.date.startsWith(curMonth));
              if(!hasRecord) monthlyRevenue += Number(h.fixedAmount || 0);
          }
      }

      totalRev += monthlyRevenue;
      factorySales.push({ name: f.name || '알수없는 공장', revenue: monthlyRevenue });

      if (searchQuery && f.name && !f.name.toLowerCase().includes(searchQuery)) continue;

      const statusSelect = `<select onchange="updateFactoryStatus('${fId}', this.value)" style="background:${f.status==='suspended'?'#94a3b8':'#00a8e8'}; color:white; border:none; padding:5px; border-radius:4px; font-size:12px;"><option value="operating" ${f.status==='operating'||!f.status?'selected':''}>운영중</option><option value="suspended" ${f.status==='suspended'?'selected':''}>미운영</option></select>`;
      const rowStyle = f.status === 'suspended' ? 'style="background-color: #f1f1f1;"' : '';
      
      // 저장된 subStatus 데이터 우선 사용 (없을 경우 dynamic calculation fallback)
      let subStatus = window.getSubscriptionStatus(f);
      if (f.subStatus) {
          const statusLabels = { 'active': '활성(사용중)', 'expiring': '만료임박', 'expired': '만료됨', 'trial': '무료체험' };
          subStatus = { status: f.subStatus, label: statusLabels[f.subStatus] || f.subStatus };
      }
      const subStyle = window.getSubscriptionStyles(subStatus.status);

      const planColors = { '라이트': '#bae6fd', '비즈니스': '#60a5fa', '엔터프라이즈': '#1e3a8a', '무료요금제': '#e2e8f0' };
      const planTextColor = { '라이트': '#0c4a6e', '비즈니스': '#ffffff', '엔터프라이즈': '#ffffff', '무료요금제': '#475569' };
      const planName = f.plan || '라이트';
      const planColor = planColors[planName] || '#e2e8f0';
      const textColor = planTextColor[planName] || '#000000';
      const planBadge = `<span style="background:${planColor}; color:${textColor}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">${planName}</span>`;

      tbody.innerHTML += `<tr ${rowStyle}><td title="${monthlyRevenue.toLocaleString()}원"><strong style="cursor:pointer; color:var(--primary);" onclick="window.openFactoryAdminView('${fId}')">${f.name || '이름없음'}</strong></td><td>${f.adminId || '-'}</td><td>${statusSelect}</td><td style="background:${subStyle.bg}; color:${subStyle.color}; font-weight:700; padding:5px; border-radius:4px;">${subStatus.label}</td><td>${planBadge} / ${f.planExpiry || '-'}</td><td><button class="btn btn-neutral" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="window.viewFactoryDetails('${fId}', true)">수정</button> <button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="window.deleteFactory('${fId}')">삭제</button></td></tr>`;

      if (f.status !== 'suspended') operatingFactories++;
  }

  document.getElementById('superTotalRevenue').innerText = totalRev.toLocaleString() + '원';
  document.getElementById('superNewFactories').innerText = newFactories + '개';
  document.getElementById('superTotalFactories').innerText = operatingFactories + '개';

  const rankArea = document.getElementById('superFactoryRankingArea');
  if(rankArea) {
      rankArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
      factorySales.sort((a,b) => b.revenue - a.revenue).slice(0, 10).map((f, i) => `
          <tr><td>${i+1}위</td><td>${f.name}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f.revenue.toLocaleString()}원</td></tr>
      `).join('') + '</tbody></table>';
  }
};

window.loadPendingPayments = async function() {
    const tbody = document.getElementById('pendingPaymentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">불러오는 중...</td></tr>';
    
    // Supabase에서 직접 가져오기
    const { data: payments, error } = await window.mySupabase.from('pending_payments').select('*');
    if (error) { console.error('결제 목록 로드 실패:', error); return; }
    
    tbody.innerHTML = '';
    (payments || []).forEach(p => {
        const f = platformData.factories[p.factory_id]; // 로컬 데이터에서 정보 가져오기
        const expiry = f ? (f.plan_expiry || '-') : '-';
        const totalAmount = p.total ? Number(p.total) : 0;
        tbody.innerHTML += `<tr>
            <td>${p.factory_name || '-'}</td>
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

window.rejectPayment = async function(paymentId) {
    if (!confirm('정말 결제 신청 내역을 삭제하시겠습니까?')) return;
    
    // Supabase에서 직접 삭제
    const { error } = await window.mySupabase.from('pending_payments').delete().eq('id', paymentId);
    
    if (error) { alert('삭제 실패: ' + error.message); return; }
    
    await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
};

window.approvePayment = async function(paymentId) {
    if (!confirm('입금이 확인되었습니다. 요금제를 승인하시겠습니까?')) return;
    
    // Supabase에서 해당 결제 정보 가져오기
    const { data: payment, error: pErr } = await window.mySupabase.from('pending_payments').select('*').eq('id', paymentId).single();
    if (pErr || !payment) { alert('결제 내역을 찾을 수 없습니다.'); return; }
    
    const fId = payment.factory_id;
    // factories 테이블 업데이트
    const { data: f, error: fErr } = await window.mySupabase.from('factories').select('*').eq('id', fId).single();
    if (fErr || !f) { alert('해당 공장을 찾을 수 없습니다.'); return; }
    
    // expiry를 오늘 기준으로 갱신 (만료일이 유효하고 미래면 해당 날짜 기준, 과거/없으면 오늘 기준)
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
    
    await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
    alert('결제 승인이 완료되었습니다.');
};

window.loadApprovedPayments = async function() {
    const tbody = document.getElementById('approvedPaymentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10">불러오는 중...</td></tr>';
    
    // Supabase에서 직접 가져오기
    const { data: payments, error } = await window.mySupabase.from('approved_payments').select('*');
    if (error) { console.error('승인된 결제 목록 로드 실패:', error); return; }
    
    tbody.innerHTML = '';
    (payments || []).slice().reverse().forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.factory_name}</td>
            <td>${p.plan}</td>
            <td>${p.months}개월</td>
            <td>${Number(p.total).toLocaleString()}원</td>
            <td>${p.request_tax_invoice ? '요청' : '미요청'}</td>
            <td>${p.depositor_name || '이름없음'}</td>
            <td>${p.date}</td>
            <td>${p.approved_at}</td>
            <td>${p.new_expiry || '-'}</td>
            <td><button class="btn btn-danger" style="padding:5px; font-size:12px; border-radius:4px; border:none;" onclick="deleteApprovedPayment('${p.id}')">삭제</button></td>
        </tr>`;
    });
};

window.openFactoryAdminView = function(fId) {
    localStorage.setItem('adminAccessFactoryId', fId);
    window.open('거래명세서프로그램v32.html', '_blank');
};

window.deleteApprovedPayment = async function(paymentId) {
    if (!confirm('정말 결제 승인 내역을 삭제하시겠습니까?')) return;
    
    // 데이터 불러오기
    platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {}, pendingFactories: {}, approvedPayments: [] };
    
    console.log("DEBUG: Attempting to delete paymentId:", paymentId);
    console.log("DEBUG: Current approvedPayments:", platformData.approvedPayments);
    
    // 삭제 시도
    const beforeLength = platformData.approvedPayments ? platformData.approvedPayments.length : 0;
    platformData.approvedPayments = platformData.approvedPayments.filter(p => String(p.id) !== String(paymentId));
    const afterLength = platformData.approvedPayments.length;
    
    console.log("DEBUG: Before filter:", beforeLength, "After filter:", afterLength);
    
    if (beforeLength === afterLength) {
        alert('삭제할 대상을 찾지 못했습니다. (ID 불일치)');
        return;
    }
    
    await saveData();
    window.loadSuperAdminDashboard();
};
