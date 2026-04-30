const fs = require('fs');
// Let's force the period string to strictly use what was selected in local storage.
// Admin view -> patch_sent_group_monthly.js
// Partner view -> patch_partner_dashboard_v35.js

let codeA = fs.readFileSync('patch_sent_group_monthly.js', 'utf8');
let newA = `// 1. DB에서 조회
        const { data: dbSent } = await window.mySupabase.from('invoices')
            .select('id, date, is_sent, hotel_id, total_amount, updated_at, hotels(name), invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('is_sent', true);

        // 2. 로컬 스토리지에서 실제 발송(버튼 클릭) 기록 가져오기 (여기에 2026-04-01 ~ 2026-04-11 이 박혀있음)
        let f = null;
        if (typeof platformData !== 'undefined' && platformData.factories) {
            f = platformData.factories[currentFactoryId];
        } else {
            const pData = JSON.parse(localStorage.getItem('laundryPlatformV4'));
            if (pData && pData.factories) f = pData.factories[currentFactoryId];
        }

        const localSentMap = {}; // key: hotelId_YYYY-MM
        if (f && f.sentInvoices && f.sentInvoices.length > 0) {
            f.sentInvoices.forEach(localInv => {
                const month = localInv.period ? localInv.period.substring(0, 7) : null;
                if (month) {
                    const k = localInv.hotelId + '_' + month;
                    // 가장 최근의 발송 기록을 덮어씀 (혹은 첫 번째)
                    if (!localSentMap[k] || new Date(localInv.sentAt) > new Date(localSentMap[k].sentAt)) {
                        localSentMap[k] = localInv;
                    }
                }
            });
        }
            
        if (dbSent && dbSent.length > 0) {
            const dbGrouped = {};
            dbSent.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                const hName = inv.hotels ? inv.hotels.name : '알수없음';
                const key = inv.hotel_id + '_' + month;
                
                if(!dbGrouped[key]) {
                    const [y, m] = month.split('-');
                    const lastDay = new Date(y, m, 0).getDate();
                    
                    // 로컬스토리지에 있는 진짜 기간이 있으면 무조건 우선! 없으면 1~말일 강제 세팅
                    const realPeriod = localSentMap[key] ? localSentMap[key].period : \`\${month}-01 ~ \${month}-\${lastDay}\`;
                    
                    dbGrouped[key] = {
                        hotelId: inv.hotel_id,
                        hotelName: hName,
                        period: realPeriod,
                        totalAmount: 0,
                        sentAt: inv.updated_at || inv.date || new Date().toISOString()
                    };
                }
                
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

codeA = codeA.replace(/const \{ data: dbSent \}.*resultArr\.push\(g\);\n                \}\n            \}\);\n        \}/s, newA);
fs.writeFileSync('patch_sent_group_monthly.js', codeA);
console.log("Admin list logic force period");


let codeP = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');
let newP = `// 1. 로컬에서 진짜 조회 기간(period) 가져오기
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
        }

        // 100% DB Driven
        const { data: list, error: dbErr } = await window.mySupabase.from('invoices')
            .select('date, is_sent, created_at, total_amount, invoice_items(qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', currentHotelId)
            .eq('is_sent', true);

        if (dbErr) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">에러: ' + dbErr.message + '</td></tr>';
            return;
        }

        const dbGrouped = {};
        if (list && list.length > 0) {
            list.forEach(inv => {
                const month = (inv.date || '').substring(0, 7);
                if(!dbGrouped[month]) {
                    const [y, m] = month.split('-');
                    const lastDay = new Date(y, m, 0).getDate();
                    
                    const realPeriod = localSentMap[month] ? localSentMap[month].period : \`\${month}-01 ~ \${month}-\${lastDay}\`;
                    
                    dbGrouped[month] = {
                        period: realPeriod,
                        totalAmount: 0,
                        sentAt: inv.created_at || inv.date || new Date().toISOString(),
                        source: 'db'
                    };
                }
                
                const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
                dbGrouped[month].totalAmount += supplyPrice;
                if(new Date(inv.created_at || inv.date) > new Date(dbGrouped[month].sentAt)) {
                    dbGrouped[month].sentAt = inv.created_at || inv.date;
                }
            });
        }`;

codeP = codeP.replace(/\/\/ 100% DB Driven.*dbGrouped\[month\]\.sentAt = inv\.created_at \|\| inv\.date;\n                \}\n            \}\);\n        \}/s, newP);
fs.writeFileSync('patch_partner_dashboard_v35.js', codeP);
console.log("Partner list logic force period");
