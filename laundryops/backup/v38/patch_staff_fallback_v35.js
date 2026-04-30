const fs = require('fs');
let code = fs.readFileSync('patch_v35_final_v3.js', 'utf8');

code = code.replace(/const staffName = \(typeof currentStaffName !== 'undefined' \&\& currentStaffName\) \? currentStaffName : \(window\.currentStaffName \|\| localStorage\.getItem\('currentStaffName'\) \|\| localStorage\.getItem\('staffName'\) \|\| '직원'\);/, 
`let staffName = (typeof currentStaffName !== 'undefined' && currentStaffName) ? currentStaffName : (window.currentStaffName || localStorage.getItem('currentStaffName') || localStorage.getItem('staffName'));
    if (!staffName) {
        try {
            const { data: st } = await window.mySupabase.from('staff').select('name').eq('factory_id', currentFactoryId).limit(1).single();
            if (st && st.name) {
                staffName = st.name;
                localStorage.setItem('currentStaffName', staffName);
            } else {
                staffName = '현장직원';
            }
        } catch(e) { staffName = '현장직원'; }
    }`);

fs.writeFileSync('patch_v35_final_v3.js', code);
console.log("Patched staffName fallback logic.");
