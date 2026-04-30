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
