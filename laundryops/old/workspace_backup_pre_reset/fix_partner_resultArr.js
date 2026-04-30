const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

const oldLogic = `        // Recover exact period from local data if available
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(localInv => {
                if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
                    const localMonth = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (localMonth && dbGrouped[localMonth]) {
                        // Override default period with exact user selection
                        dbGrouped[localMonth].period = localInv.period;
                    }
                }
            });
        }

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>';
            return;
        }`;

const newLogic = `        // Recover exact period from local data if available
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(localInv => {
                if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
                    const localMonth = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (localMonth && dbGrouped[localMonth]) {
                        // Override default period with exact user selection
                        dbGrouped[localMonth].period = localInv.period;
                    }
                }
            });
        }
        
        resultArr = Object.values(dbGrouped);

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>';
            return;
        }`;

if(code.includes('if (resultArr.length === 0) {')) {
    code = code.replace(oldLogic, newLogic);
    fs.writeFileSync('patch_partner_dashboard_v35.js', code);
    console.log("Patched resultArr logic");
}
