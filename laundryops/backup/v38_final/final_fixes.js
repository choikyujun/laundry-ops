// 1. 관리자 화면 삭제 기능 DB와 연동
window.deleteInvoice = async function(invId) {
    if(!confirm('정말 이 명세서를 삭제하시겠습니까? (삭제된 데이터는 복구할 수 없습니다)')) return;
    try {
        const { error } = await window.mySupabase.from('invoices').delete().eq('id', invId);
        if (error) throw error;
        if(typeof window.loadAdminRecentInvoices === 'function') window.loadAdminRecentInvoices();
        if(typeof window.loadAdminDashboard === 'function') window.loadAdminDashboard();
        alert('삭제되었습니다.');
    } catch(err) {
        alert('삭제 중 오류가 발생했습니다: ' + err.message);
    }
};

// 2. 직원 삭제 기능 DB와 연동 (v38 수정)
window.deleteStaff = async function(sId) {
    if(!confirm('정말 이 직원을 삭제하시겠습니까? (삭제된 데이터는 복구할 수 없습니다)')) return;
    
    try {
        const { error } = await window.mySupabase.from('staff').delete().eq('id', sId);
        if (error) throw error;
        
        alert('삭제되었습니다.');
        if(typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList();
    } catch(err) {
        alert('삭제 중 오류가 발생했습니다: ' + err.message);
    }
};

window.calculateAdminDashStats = async function() {
    console.log("DEBUG: Final unified calculateAdminDashStats started");
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    // YYYY-MM
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    const hotelSales = {};

    // 1. 매출 합산 (전체 거래처)
    const { data: invData } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, hotels(name, contract_type)')
        .eq('factory_id', currentFactoryId);
    
    if(invData) {
        invData.forEach(inv => {
            if (inv.hotels && inv.hotels.contract_type === 'fixed') return;

            const hName = inv.hotels ? inv.hotels.name : '알수없음';
            const supplyPrice = inv.total_amount;
            if(inv.date === todayStr) todayRev += supplyPrice;
            if(inv.date.startsWith(curMonth)) {
                monthRev += supplyPrice;
                hotelSales[hName] = (hotelSales[hName] || 0) + supplyPrice;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += supplyPrice;
        });
    }

    // 2. 정액제 매출 합산
    const { data: hotelData } = await window.mySupabase.from('hotels')
        .select('name, contract_type, fixed_amount, created_at')
        .eq('factory_id', currentFactoryId);
        
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
                const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
                if (curMonth >= createdMonth) {
                    monthRev += fixAmt;
                    hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
                }
                if (prevMonthStr >= createdMonth) {
                    prevMonthRev += fixAmt;
                }
            }
        });
    }
    
    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    let growth = 0;
    if (prevMonthRev > 0) {
        growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
    } else if (monthRev > 0) {
        growth = 100; // 전월 매출 없고 이번달 매출 있으면 100%
    }
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) el3.innerHTML = growth >= 0 ? '<span style="color:var(--success);">&#9650; ' + growth.toFixed(1) + '%</span>' : '<span style="color:var(--danger);">&#9660; ' + Math.abs(growth).toFixed(1) + '%</span>';
    
    const el4 = document.getElementById('adminSummaryCount');
    if(el4) {
        const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
        el4.innerText = `${activeHotels} / ${staffCount || 0}`;
    }

    // TOP 10 렌더링
    const titleEl = document.getElementById('rankingTitle');
    if (titleEl) titleEl.innerHTML = `${parts[0]}년 ${parts[1]}월 매출 TOP 10`;
    
    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
        rankingArea.innerHTML = sorted.length === 0 ? '<div style="color:gray; padding:10px;">데이터가 없습니다.</div>' : 
            '<table class="admin-table"><thead><tr><th>순위</th><th>거래처명</th><th>이번 달 매출</th></tr></thead><tbody>' + 
            sorted.slice(0, 10).map((f, i) => `<tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right;">${f[1].toLocaleString()}원</td></tr>`).join('') + '</tbody></table>';
    }
};

window.updateTrendChartOnly = async function() {
    console.log("DEBUG: Final unified updateTrendChartOnly started");
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // 1. 단가제 매출
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount, hotel_id, hotels(contract_type)').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            if (inv.hotels && inv.hotels.contract_type === 'fixed') return;
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += inv.total_amount;
        });
    }
    
    // 2. 정액제 매출
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount, created_at').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    if (mKey >= createdMonth) {
                        monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                    }
                }
            }
            
            if (hotelFilter !== 'all' && h.id === hotelFilter) {
                for (const mKey in monthlyTrend) {
                    if (mKey < createdMonth) {
                        monthlyTrend[mKey] = 0;
                    }
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};

window.loadAdminDashboard = async function() {
    console.log("DEBUG: [v38] loadAdminDashboard started");

    const statsMonth = document.getElementById('adminStatsMonth');
    if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);
    
    // 2. 매출 요약 계산 (전역 함수 호출)
    await window.calculateAdminDashStats();

    // 1. 공장 정보 및 구독 상태 로드
    const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!f) return;

    // 구독 배너 로직 (기존 유지)
    const subStatusLeft = document.getElementById('subStatusLeft');
    const subPlanRight = document.getElementById('subPlanRight');
    const subBanner = document.getElementById('subBanner');
    
    if (subStatusLeft && subPlanRight && subBanner) {
        const subLabel = f.sub_status === 'expired' ? '만료됨' : (f.sub_status === 'expiring' ? '만료임박' : '활성(사용중)');
        subStatusLeft.innerHTML = '구독상태: ' + subLabel;
        subPlanRight.innerHTML = '요금제: ' + (f.plan || '라이트') + ' | 만료일: ' + (f.plan_expiry || '제한없음');
        subBanner.style.background = f.sub_status === 'expired' ? '#fee2e2' : (f.sub_status === 'expiring' ? '#fef3c7' : '#e0f2fe');
    }

    // 3. 거래처 드롭다운 업데이트
    const { data: hotels } = await window.mySupabase
        .from('hotels')
        .select('id, name')
        .eq('factory_id', currentFactoryId)
        .order('name');

    ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
        const select = document.getElementById(id);
        if(select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="all">전체 거래처</option>';
            if(hotels) hotels.forEach(h => select.innerHTML += '<option value="' + h.id + '">' + h.name + '</option>');
            select.value = currentVal || 'all';
        }
    });

    // 4. 거래명세서 목록 로드 및 차트 데이터 갱신
    await window.loadAdminRecentInvoices();
    await window.updateTrendChartOnly();
};