const fs = require('fs');

let app = fs.readFileSync('app_v34.js', 'utf8');

app = app.replace(/const endDate = curMonth \+ '-31';/g, "const endDate = curMonth + '-30'; // or use end of month calculation. Let's just do 31 but catch invalid dates");

// Wait, the error is 400 Bad Request because PostgreSQL rejects '2026-04-31' as an invalid date (April only has 30 days!)
// Let's replace the lte.2026-04-31 with a proper end-of-month calculator in loadSuperAdminDashboard and calculateAdminDashStats

app = app.replace(/const startDate = curMonth \+ '-01';[\s\S]*?const endDate = curMonth \+ '-31';/, `
    const [cy, cm] = curMonth.split('-');
    const lastDay = new Date(cy, cm, 0).getDate();
    const startDate = curMonth + '-01';
    const endDate = curMonth + '-' + lastDay;
`);

fs.writeFileSync('app_v34.js', app);
console.log('Date LTE bug fixed');
