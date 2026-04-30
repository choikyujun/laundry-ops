const fs = require('fs');

// Remove all local JSON fallback code from the 3 main lists:
// 1. loadAdminSentList (patch_sent_group_monthly.js)
// 2. loadAdminRecentInvoices (patch_admin_invoices_list_fix.js)
// 3. loadHotelReceivedInvoicesList (patch_partner_dashboard_v35.js)

// 1. adminSentList
let code1 = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');

const oldLogic1 = `        let f = platformData.factories[currentFactoryId];
        if (!f) {
            platformData = JSON.parse(localStorage.getItem('laundryPlatformV4')) || { factories: {} };
            f = platformData.factories[currentFactoryId];
        }
        
        let resultArr = [];
        if (f && f.sentInvoices) {
            resultArr = f.sentInvoices.filter(inv =>
                (inv.hotelName || '').toLowerCase().includes(searchTerm) || (inv.period || '').includes(searchTerm)
            );
        }

        // DB에서 최신 발송 내역과 조합하여 "발송 그룹"을 묶어내기 (과거 로컬 데이터가 날아갔을 경우를 대비)
        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);
            
        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                if(!dbGrouped[key]) {
                    dbGrouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                dbGrouped[key].totalAmount += (Number(inv.total_amount) || 0);
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });
            
            // 로컬 데이터(resultArr)에 없는 DB 발송 그룹만 추가
            Object.values(dbGrouped).forEach(g => {
                const exists = resultArr.find(r => r.hotelName === g.hotelName && r.period.includes(g.period));
                if (!exists) {
                    if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                        resultArr.push(g);
                    }
                }
            });
        }`;

const newLogic1 = `        let resultArr = [];
        
        // 100% DB Driven (is_sent = true)
        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, invoice_items(qty, price), hotels(name)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);
            
        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                if(!dbGrouped[key]) {
                    dbGrouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: month,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                
                // 실제 공급가(단가 x 수량) 계산
                const items = inv.invoice_items || [];
                const supplyPrice = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[key].totalAmount += supplyPrice;
                
                if(new Date(inv.updated_at || inv.date) > new Date(dbGrouped[key].sentAt)) {
                    dbGrouped[key].sentAt = inv.updated_at || inv.date;
                }
            });
            
            Object.values(dbGrouped).forEach(g => {
                if (g.hotelName.toLowerCase().includes(searchTerm) || g.period.includes(searchTerm)) {
                    resultArr.push(g);
                }
            });
        }`;

code1 = code1.replace(oldLogic1, newLogic1);
fs.writeFileSync('patch_sent_group_monthly.js', code1);
console.log("Cleaned adminSentList.");

// 3. Partner received invoices
let code3 = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

const oldLogic3 = `        // DB에서 최우선으로 꺼내옵니다.
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

const newLogic3 = `        // 100% DB Driven
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
        
        let resultArr = Object.values(dbGrouped);`;

code3 = code3.replace(oldLogic3, newLogic3);
fs.writeFileSync('patch_partner_dashboard_v35.js', code3);
console.log("Cleaned partnerReceivedList.");

