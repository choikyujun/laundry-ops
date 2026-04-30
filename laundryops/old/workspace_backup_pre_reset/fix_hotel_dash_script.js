const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// There is a chance that updateHotelItemChart and updateHotelTrendChart are throwing errors
// which halts the rest of the execution. Let's make sure they don't break.
const updateChartFix = `window.updateHotelItemChart = function(stats) {
    try {
        const canvas = document.getElementById('hotelItemPieChart');
        const msg = document.getElementById('hotelNoChartMsg');
        if (!canvas || !msg) return;

        if(Object.keys(stats).length === 0) { 
            canvas.style.display = 'none'; 
            msg.style.display = 'block'; 
            return; 
        }
        canvas.style.display = 'block'; 
        msg.style.display = 'none';
        
        if(window.hotelItemChart) window.hotelItemChart.destroy();
        window.hotelItemChart = new Chart(canvas, { 
            type: 'doughnut', 
            data: { 
                labels: Object.keys(stats), 
                datasets: [{ data: Object.values(stats), backgroundColor: ['#005b9f','#00a8e8','#8b5cf6','#10b981','#f59e0b','#ef4444','#64748b'] }] 
            }, 
            options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } } 
        });
    } catch(e) { console.error("Chart Error:", e); }
};

window.updateHotelTrendChart = function(data) {
    try {
        const canvas = document.getElementById('hotelTrendBarChart');
        if(!canvas) return;
        
        if(window.hotelTrendChart) window.hotelTrendChart.destroy();
        window.hotelTrendChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(data).map(m => m.substring(5) + '월'),
                datasets: [{ label: '월별 매출', data: Object.values(data), backgroundColor: '#005b9f' }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    } catch(e) { console.error("Chart Error:", e); }
};

`;

if (!code.includes('window.updateHotelItemChart = function')) {
    code = updateChartFix + code;
    fs.writeFileSync('patch_partner_dashboard_v35.js', code);
    console.log("Added chart functions to partner patch");
}
