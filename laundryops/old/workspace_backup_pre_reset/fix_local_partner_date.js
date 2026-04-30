const fs = require('fs');

let codeP = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// The local logic in partner dashboard:
const oldP = `        // 1. 로컬에서 진짜 조회 기간(period) 가져오기
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

const newP = `        // 1. 로컬에서 진짜 조회 기간(period) 강제로 가져오기 (전역 객체보다 로컬 스토리지 우선)
        let f = null;
        const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
        if (pData && pData.factories && pData.factories[currentFactoryId]) {
            f = pData.factories[currentFactoryId];
        } else if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        }

        const localSentMap = {}; // key: YYYY-MM
        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(localInv => {
                if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
                    const month = localInv.period ? localInv.period.substring(0, 7) : null;
                    if (month) {
                        if (!localSentMap[month] || new Date(localInv.sentAt) > new Date(localSentMap[month].sentAt)) {
                            localSentMap[month] = localInv;
                            console.log("DEBUG: Mapped local period for", month, "=>", localInv.period);
                        }
                    }
                }
            });
        }`;

codeP = codeP.replace(oldP, newP);
fs.writeFileSync('patch_partner_dashboard_v35.js', codeP);
console.log("Fixed partner local extraction priority");
