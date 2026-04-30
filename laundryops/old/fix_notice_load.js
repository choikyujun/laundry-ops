const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I notice `window.loadGlobalNotice()` is only called in `window.login = async function` when logging in as `superadmin`.
// It should also be called when logging in as `admin`.
// And probably `hotel` and `staff` too, if the banner is global.
// Let's add it to the other logins.

code = code.replace(
    /localStorage\.setItem\('currentFactoryId', data\.id\);\s*\/\/ \[만료일 체크 및 구독 상태 자동 업데이트\]/g,
    `localStorage.setItem('currentFactoryId', data.id);
        
        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
        
        // [만료일 체크 및 구독 상태 자동 업데이트]`
);

code = code.replace(
    /localStorage\.setItem\('currentFactoryId', data\.factory_id\);\s*showView\('staffView'/g,
    `localStorage.setItem('currentFactoryId', data.factory_id);

        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();

        showView('staffView'`
);

code = code.replace(
    /localStorage\.setItem\('currentHotelId', data\.id\);\s*\/\/ 호환성 껍데기/g,
    `localStorage.setItem('currentHotelId', data.id);

        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();

        // 호환성 껍데기`
);

fs.writeFileSync('app_v38.js', code);
