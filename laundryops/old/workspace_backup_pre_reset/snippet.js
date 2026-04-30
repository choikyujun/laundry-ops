    document.getElementById('s_address').value = f.address || '';
    document.getElementById('s_bankInfo').value = f.bankInfo || '';
    openModal('factoryModal');
};

window.saveNewFactory = async function() {
