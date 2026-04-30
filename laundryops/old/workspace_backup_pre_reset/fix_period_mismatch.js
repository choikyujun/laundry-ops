const fs = require('fs');

// The issue is the partner view doesn't match the local sentObj correctly.
// Let's check how the partner view extracts it.

let codeP = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');
const pLogic = `        // 1. 로컬에서 진짜 조회 기간(period) 가져오기
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        const localSentMap = {}; // key: YYYY-MM
        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(localInv => {
                if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
                    const month = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (month) {
                        if (!localSentMap[month] || new Date(localInv.sentAt) > new Date(localSentMap[month].sentAt)) {
                            localSentMap[month] = localInv;
                        }
                    }
                }
            });
        }`;

// The issue might be that in the partner view, currentHotelId and currentFactoryId match, but the month extraction is failing or something.
// Oh! In patch_partner_dashboard_v35.js:
// const month = localInv.period ? localInv.period.substring(0, 7) : null;
// Wait, if period is "2026-04-02 ~ 2026-04-17", month is "2026-04".
// And dbGrouped is grouped by "2026-04".
// So it should match!
console.log("Reading partner code...");
