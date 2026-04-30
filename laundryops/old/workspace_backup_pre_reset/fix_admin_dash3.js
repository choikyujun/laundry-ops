const fs = require('fs');
let app = fs.readFileSync('app_v34.js', 'utf8');

app += `
// [v34 강제 버그픽스] loadAdminDashboard 끝날 때 목록 갱신 필수 호출
const _finalDashboardHook = window.loadAdminDashboard;
window.loadAdminDashboard = async function() {
    await _finalDashboardHook();
    if(typeof window.loadAdminRecentInvoices === 'function') {
        console.log("DEBUG: Triggering invoice list load from Dashboard");
        await window.loadAdminRecentInvoices();
    }
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        if(document.getElementById('adminView') && document.getElementById('adminView').classList.contains('active')) {
            if(typeof window.loadAdminDashboard === 'function') await window.loadAdminDashboard();
        }
    }, 500);
});
`;
fs.writeFileSync('app_v34.js', app);
console.log('Appended forceful invoice load trigger');
