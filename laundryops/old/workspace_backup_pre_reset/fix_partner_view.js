// 파트너 화면 (거래처 로그인 시) 데이터도 Supabase와 연결, 껍데기 JSON에서 벗어남
const fs = require('fs');

const code = `
window.loadHotelDashboard = async function() {
    console.log("DEBUG: loadHotelDashboard called for v35");
    const { data: fData } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!fData) return;
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', currentHotelId).single();
    if (!hData) return;

    const statsInp = document.getElementById('hotelInvoiceMonth');
    const today = getTodayString();
    const sMonth = statsInp ? (statsInp.value || today.substring(0, 7)) : today.substring(0, 7);
    if(statsInp) statsInp.value = sMonth;

    const hTitle = document.getElementById('hotelNameTitle');
    if (hTitle) hTitle.innerText = hData.name;
    
    const hPhone = document.getElementById('h_factoryPhone');
    if (hPhone) hPhone.innerText = fData.phone || '-';
    
    const hCeo = document.getElementById('h_factoryCeo');
    if (hCeo) hCeo.innerText = fData.ceo || '-';

    const hContractStr = hData.contract_type === 'fixed' ? '정액제' : '단가제';
    const cTypeEl = document.getElementById('h_contractType');
    if (cTypeEl) cTypeEl.innerText = hContractStr;
    const cValEl = document.getElementById('h_contractValue');
    if (cValEl) cValEl.innerText = hData.contract_type === 'fixed' ? Number(hData.fixed_amount||0).toLocaleString()+'원' : '-';

    let total = 0;
    let count = 0;
    const itemStats = {};
    const monthlyTrend = {};

    const [y, m] = sMonth.split('-');
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }

    const tbody = document.getElementById('hotelRecentInvoiceList');
    if(tbody) tbody.innerHTML = '';

    const { data: list } = await window.mySupabase.from('invoices')
        .select('id, date, invoice_items(name, qty, price)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', currentHotelId)
        .order('date', { ascending: false });

    if(list) {
        list.forEach(inv => {
            const items = inv.invoice_items || [];
            const invSum = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
            
            if(inv.date.startsWith(sMonth)) {
                total += invSum; 
                count++; 
                items.forEach(it => itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty||0));
                
                if(tbody) {
                    tbody.innerHTML += \`<tr>
                        <td>\${inv.date}</td>
                        <td style="text-align:right;">\${invSum.toLocaleString()}원</td>
                        <td><span class="badge" style="background:var(--success)">입고완료</span></td>
                        <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('\${inv.id}')">보기</button></td>
                    </tr>\`;
                }
            }

            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += invSum;
        });
    }
    
    // 정액제 거래처의 경우 총액 덮어쓰기
    if (hData.contract_type === 'fixed') {
        const fixAmt = Number(hData.fixed_amount || 0);
        total = fixAmt;
        for (const mKey in monthlyTrend) {
            monthlyTrend[mKey] = fixAmt;
        }
    }

    const tEl = document.getElementById('hotelTotalAmount');
    if(tEl) tEl.innerText = total.toLocaleString() + '원';
    const cEl = document.getElementById('hotelTotalCount');
    if(cEl) cEl.innerText = count + '건';

    const rankArea = document.getElementById('hotelItemRanking');
    if(rankArea) {
        const sorted = Object.entries(itemStats).sort((a,b) => b[1] - a[1]);
        if(sorted.length === 0) rankArea.innerHTML = '<div style="color:var(--secondary); font-size:13px;">이용 내역이 없습니다.</div>';
        else {
            rankArea.innerHTML = '<table style="width:100%; border-collapse:collapse; text-align:left;"><tbody>' + 
            sorted.slice(0, 5).map((f, i) => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:8px 0; color: #475569;">\${i+1}위</td>
                    <td style="padding:8px 0; font-weight:600;">\${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary); padding:8px 0;">\${f[1]}</td>
                </tr>
            \`).join('') + '</tbody></table>';
        }
    }
    
    if(typeof window.updateHotelTrendChart === 'function') window.updateHotelTrendChart(monthlyTrend);
    if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();
};

window.loadHotelReceivedInvoicesList = async function() {
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
};

window.confirmSentReportByPeriod = async function(sentAt) {
    if(!confirm('해당 명세서를 확인하고 정산 완료(지급 대기) 상태로 전환하시겠습니까?')) return;

    try {
        const { data: hData } = await window.mySupabase.from('hotels').select('confirmed_months').eq('id', currentHotelId).single();
        if(!hData) return;

        let confirmed = hData.confirmed_months || {};
        confirmed[sentAt] = true;
        
        // 이 때 period 로도 같이 저장해 줌 (DB 호환)
        // 화면에서 호출할 때 period 자체를 매개변수로 받았으면 좋겠지만 일단 sentAt 으로도 됨

        await window.mySupabase.from('hotels').update({ confirmed_months: confirmed }).eq('id', currentHotelId);

        // 하위 호환 로컬 스토리지
        if(typeof platformData !== 'undefined' && platformData.factories[currentFactoryId]) {
            const h = platformData.factories[currentFactoryId].hotels[currentHotelId];
            if(h) {
                if(!h.confirmedMonths) h.confirmedMonths = {};
                h.confirmedMonths[sentAt] = true;
                localStorage.setItem('laundryPlatformV4', JSON.stringify(platformData));
            }
        }

        alert('정산이 확인되었습니다.');
        
        // 모달창 강제 닫기
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.style.display = 'none');

        window.loadHotelReceivedInvoicesList(); 
    } catch(e) {
        alert('에러 발생: ' + e.message);
    }
};

// 파트너 탭 변경 감지
const origPartnerSwitchTab = window.switchTab;
window.switchTab = async function(el, tabId) {
    if (tabId === 'hotelStats' || tabId === 'hotelInvoice') {
        const parent = el.closest('.view');
        if (parent) {
            parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            const target = parent.querySelector('#tab_' + tabId);
            if(target) target.classList.add('active');
        }
        
        if(tabId === 'hotelStats') {
            if(typeof window.loadHotelDashboard === 'function') window.loadHotelDashboard();
        }
        if(tabId === 'hotelInvoice') {
            if(typeof window.loadHotelReceivedInvoicesList === 'function') window.loadHotelReceivedInvoicesList();
        }
    } else {
        if (typeof origPartnerSwitchTab === 'function') {
            origPartnerSwitchTab(el, tabId);
        }
    }
};
`;

fs.writeFileSync('patch_partner_dashboard_v35.js', code);
console.log("Partner dashboard completely rewritten for DB");
