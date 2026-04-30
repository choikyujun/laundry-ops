const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// There might be a bug where DB records are discarded or period match fails.
// Let's simplify the combination of Local & DB records.
const oldLogic = `        // 1. 로컬(구버전 하위호환)에서 꺼내오기
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(inv => {
                if (inv.hotelId === currentHotelId || inv.hotelName === hData.name) {
                    resultArr.push({
                        period: inv.period || '2026-04',
                        totalAmount: inv.supplyPrice || inv.totalAmount || 0,
                        sentAt: inv.sentAt || new Date().toISOString()
                    });
                }
            });
        }

        // 2. DB에서 꺼내와서 병합
        const { data: list } = await window.mySupabase.from('invoices')
            .select('date, is_sent, updated_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        if (list && list.length > 0) {
            const dbGrouped = {};
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const key = month;
                if(!dbGrouped[key]) {
                    dbGrouped[key] = {
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[key].totalAmount += supplyPrice;
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });

            // 로컬에 없는 달이면 추가
            Object.values(dbGrouped).forEach(g => {
                const exists = resultArr.find(r => r.period.includes(g.period));
                if (!exists) {
                    resultArr.push(g);
                }
            });
        }`;

const newLogic = `        // DB에서 최우선으로 꺼내옵니다.
        const { data: list } = await window.mySupabase.from('invoices')
            .select('date, is_sent, updated_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        const dbGrouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    dbGrouped[month] = {
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString(),
                        source: 'db'
                    };
                }
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[month].totalAmount += supplyPrice;
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[month].sentAt)) {
                    dbGrouped[month].sentAt = inv.updated_at || inv.date;
                }
            });
        }
        
        let resultArr = Object.values(dbGrouped);

        // 로컬(구버전 하위호환)에서 DB에 없는 기간만 덧붙이기
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(inv => {
                if (inv.hotelId === currentHotelId || inv.hotelName === hData.name) {
                    const localMonth = inv.period ? inv.period.substring(0, 7) : '2026-04';
                    // DB 데이터에 없는 월(period)이면 로컬 껍데기를 사용
                    if (!resultArr.find(r => r.period === localMonth || r.period.includes(localMonth))) {
                        resultArr.push({
                            period: inv.period || localMonth,
                            totalAmount: inv.supplyPrice || inv.totalAmount || 0,
                            sentAt: inv.sentAt || new Date().toISOString(),
                            source: 'local'
                        });
                    }
                }
            });
        }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Rewrote fallback logic.");
