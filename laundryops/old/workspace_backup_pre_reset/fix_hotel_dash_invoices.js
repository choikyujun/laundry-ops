const fs = require('fs');

let code = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// The problem might be the grouping logic or `platformData` reliance 
// resulting in an empty array if `f.sentInvoices` is not correctly structured.
// Or the array is built, but not rendering because of JS error inside `loadHotelReceivedInvoicesList`.
// Let's rewrite `loadHotelReceivedInvoicesList` to be bulletproof.

const oldLogic = `window.loadHotelReceivedInvoicesList = async function() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신 내역을 불러오는 중...</td></tr>';

    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', currentHotelId).single();
    if(!hData) return;

    // Supabase DB에서 is_sent=true, hotel_id=currentHotelId 인 내역을 월별로 그룹핑
    const { data: list } = await window.mySupabase.from('invoices')
        .select('date, is_sent, updated_at, total_amount, invoice_items(qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', currentHotelId)
        .eq('is_sent', true);

    const grouped = {};

    if (list && list.length > 0) {
        list.forEach(inv => {
            const month = (inv.date || '').substring(0, 7);
            const key = 'db_' + month;
            if(!grouped[key]) {
                grouped[key] = {
                    period: month,
                    totalAmount: 0,
                    sentAt: inv.updated_at || inv.date,
                    source: 'db'
                };
            }
            const supplyPrice = (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
            grouped[key].totalAmount += supplyPrice;
            if(new Date(inv.updated_at || inv.date) > new Date(grouped[key].sentAt)) {
                grouped[key].sentAt = inv.updated_at || inv.date;
            }
        });
    }

    const resultArr = Object.values(grouped);

    // 하위 호환 로컬 데이터
    const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
    if (f && f.sentInvoices && f.sentInvoices.length > 0) {
        f.sentInvoices.forEach(inv => {
            if (inv.hotelId === currentHotelId || inv.hotelName === hData.name) {
                const month = inv.period ? inv.period.substring(0, 7) : '2026-04';
                const key = 'local_' + month;
                if(!grouped[key] && !resultArr.find(r => r.period === month)) {
                    resultArr.push({
                        period: inv.period,
                        totalAmount: inv.supplyPrice || inv.totalAmount, // 공급가 우선
                        sentAt: inv.sentAt,
                        source: 'local'
                    });
                }
            }
        });
    }

    if (resultArr.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>';
        return;
    }

    resultArr.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));
    tbody.innerHTML = '';
    
    // hData 에 기록된 confirmed_months(정산완료 상태)
    const confirmedMonths = hData.confirmed_months || {};

    resultArr.forEach(inv => {
        // [중요] 정액제이면 총액을 덮어씀
        let displayAmount = inv.totalAmount;
        if (hData.contract_type === 'fixed') {
            displayAmount = Number(hData.fixed_amount || 0);
        }
        
        // 정산 완료 여부 체크
        // 구버전(sentAt)과 신버전(period) 둘 다 호환되게 체크
        const isConfirmed = confirmedMonths[inv.sentAt] === true || confirmedMonths[inv.period] === true;
        const statusBadge = isConfirmed ?
            '<span class="badge" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px;">정산완료</span>' :
            '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px;">수신중</span>';

        // 공급가는 인쇄/상세 팝업에서 알아서 계산해줌. 여기선 노출용 표시
        tbody.innerHTML += \`<tr>
            <td>\${inv.period}</td>
            <td style="text-align:right; font-weight:700;">\${displayAmount.toLocaleString()}원</td>
            <td>\${statusBadge}</td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('\${hData.name}', '\${inv.period}', '\${inv.sentAt}', true)">상세</button></td>
        </tr>\`;
    });
};`;

const newLogic = `window.loadHotelReceivedInvoicesList = async function() {
    try {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신 내역을 불러오는 중...</td></tr>';

        const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', currentHotelId).single();
        if(!hData) return;

        let resultArr = [];
        
        // 1. 로컬(구버전 하위호환)에서 꺼내오기
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
        }

        if (resultArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">수신된 정산 리포트가 없습니다.</td></tr>';
            return;
        }

        resultArr.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));
        tbody.innerHTML = '';
        
        const confirmedMonths = hData.confirmed_months || {};

        resultArr.forEach(inv => {
            let displayAmount = inv.totalAmount;
            if (hData.contract_type === 'fixed') {
                displayAmount = Number(hData.fixed_amount || 0);
            }
            
            const isConfirmed = confirmedMonths[inv.sentAt] === true || confirmedMonths[inv.period] === true;
            const statusBadge = isConfirmed ?
                '<span class="badge" style="background:var(--success); color:white; padding:2px 6px; border-radius:4px;">정산완료</span>' :
                '<span class="badge" style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px;">수신중</span>';

            tbody.innerHTML += \`<tr>
                <td>\${inv.period}</td>
                <td style="text-align:right; font-weight:700;">\${Number(displayAmount).toLocaleString()}원</td>
                <td>\${statusBadge}</td>
                <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('\${hData.name}', '\${inv.period}', '\${inv.sentAt}', true)">상세</button></td>
            </tr>\`;
        });
    } catch(e) {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">에러: ' + e.message + '</td></tr>';
    }
};`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Rewrote loadHotelReceivedInvoicesList to be safer.");

