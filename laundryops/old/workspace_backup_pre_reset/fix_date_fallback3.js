const fs = require('fs');

let codeP = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// "2026-04-01 ~ 2026-04-30" means the DB grouping created "2026-04" but didn't find localSentMap["2026-04"].
// Why?
// Because in localSentMap generation:
// if (localInv.hotelId === currentHotelId || localInv.hotelName === hData.name) {
// Wait, when saving the local sent data, maybe hotelId wasn't saved or saved as the hotel's Name by accident?
// Let's check `patch_admin_dashboard_stats_and_print.js`

let codeA = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');
const searchStr = `const sentObj = {
                        sentAt: new Date().toISOString(),
                        hotelId: hotelFilter,
                        hotelName: report.hName,
                        period: sDate + ' ~ ' + eDate,`;

if(codeA.includes(searchStr)) {
    console.log("sentObj has hotelId:", "hotelFilter", "and hotelName:", "report.hName");
} else {
    console.log("Could not find sentObj");
}

// In the screenshot, Miiz shows "2026-04-02 ~ 2026-04-17", but in partner view it shows "2026-04-01 ~ 2026-04-30".
// This proves that `localSentMap` is populated in admin view but NOT populated in partner view.
// Why? Because in Partner view, `currentFactoryId` might be different, or `f` is fetched directly from Supabase and overriding local?
// Let's check:
/*
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }
*/
// Ah! In v35, `platformData` might NOT be fully populated for partner view because JSON sync is disabled.
// Thus `platformData.factories[currentFactoryId]` might not have `sentInvoices`.
// Wait, `pData` loaded from localStorage *would* have it because Admin just saved it to localStorage.
console.log("Checking partner local load");
