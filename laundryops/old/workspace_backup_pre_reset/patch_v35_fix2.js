window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    // 특수거래처일 경우 불필요한 '기본', '기타' 카테고리 삭제 (클린업)
    if (isSpecial) {
        await window.mySupabase.from('hotel_categories').delete().eq('hotel_id', hId).in('name', ['기본', '기타']);
    }

    // 1. 거래처에 등록된 품목이 있는지 확인
    const { data: existItems } = await window.mySupabase.from('hotel_item_prices').select('id').eq('hotel_id', hId).limit(1);
    
    if (!existItems || existItems.length === 0) {
        // 특수거래처는 기본 단가를 강제로 복사해서 넣지 않음. (빈 화면에서 직접 카테고리 추가하도록)
        if (!isSpecial) {
            const { data: defaults } = await window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId);
            if (defaults && defaults.length > 0) {
                const inserts = defaults.map(d => ({
                    factory_id: currentFactoryId,
                    hotel_id: hId,
                    category_name: null,
                    name: d.name,
                    price: d.price,
                    unit: d.unit
                }));
                await window.mySupabase.from('hotel_item_prices').insert(inserts);
            }
        }
    }

    if (isSpecial) {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        await window.loadHotelCategoryList();
        await window.loadHotelPriceList(); 
        openModal('priceSettingModal');
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        await window.loadSimplePriceList();
        openModal('simplePriceModal');
    }
};

// 월정산발송내역 에러 픽스 (updated_at 컬럼 미존재 가능성, JSON 파싱 등)
window.loadAdminSentList = async function() { console.log("loadAdminSentList called!");
    const tbody = document.getElementById('adminSentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송 내역을 불러오는 중...</td></tr>';

    const searchTerm = document.getElementById('adminSentSearch')?.value.toLowerCase() || '';

    // select 시 updated_at 제거 (created_at 사용)
    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, total_amount, created_at, hotel_id, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .eq('is_sent', true);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`;
        return;
    }

    // 기존 localStorage 의 sentInvoices 도 합쳐서 보여주기 (하위호환)
    const f = (typeof platformData !== 'undefined' && platformData.factories) ? platformData.factories[currentFactoryId] : null;
    let localSent = [];
    if (f && f.sentInvoices) {
        localSent = f.sentInvoices;
    }

    if ((!list || list.length === 0) && localSent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">발송된 내역이 없습니다.</td></tr>';
        return;
    }

    // DB 데이터 그룹화
    const grouped = {};
    if (list) {
        list.forEach(inv => {
            const month = inv.date.substring(0, 7); 
            const key = 'db_' + inv.hotel_id + '_' + month;
            if(!grouped[key]) {
                grouped[key] = {
                    hotelId: inv.hotel_id,
                    hotelName: inv.hotels ? inv.hotels.name : '알수없음',
                    month: month,
                    totalAmount: 0,
                    lastSent: inv.created_at || inv.date,
                    count: 0,
                    source: 'db'
                };
            }
            grouped[key].totalAmount += (inv.total_amount || 0);
            grouped[key].count += 1;
        });
    }

    // 로컬 데이터 그룹화
    localSent.forEach(inv => {
        const month = inv.period ? inv.period.substring(0, 7) : '알수없음';
        const key = 'local_' + inv.hotelName + '_' + month;
        if(!grouped[key]) {
            grouped[key] = {
                hotelId: inv.hotelId || inv.hotelName,
                hotelName: inv.hotelName,
                month: month,
                totalAmount: 0,
                lastSent: inv.sentAt,
                count: 1,
                source: 'local'
            };
        }
        grouped[key].totalAmount += (inv.totalAmount || 0);
    });

    const resultArr = Object.values(grouped).filter(g => 
        g.hotelName.toLowerCase().includes(searchTerm) || g.month.includes(searchTerm)
    );

    resultArr.sort((a,b) => new Date(b.lastSent) - new Date(a.lastSent));

    window.adminSentPage = window.adminSentPage || 1;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(resultArr.length / itemsPerPage);
    if (window.adminSentPage > totalPages && totalPages > 0) window.adminSentPage = totalPages;

    const paginated = resultArr.slice((window.adminSentPage - 1) * itemsPerPage, window.adminSentPage * itemsPerPage);

    tbody.innerHTML = '';
    
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">검색 결과가 없습니다.</td></tr>';
    } else {
        paginated.forEach(inv => {
            const displayTotal = inv.source === 'db' ? Math.round(inv.totalAmount * 1.1) : inv.totalAmount;
            
            const sentDt = new Date(inv.lastSent);
            let dStr = isNaN(sentDt.getTime()) ? inv.lastSent : sentDt.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            tbody.innerHTML += `<tr>
                <td>${inv.month} ${inv.source==='local' ? '(구버전)' : ''}</td>
                <td><strong>${inv.hotelName}</strong> <small>(${inv.count}건)</small></td>
                <td>${displayTotal.toLocaleString()}원</td>
                <td>${dStr}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewSentDetail('${inv.hotelName}', '${inv.month}', '${inv.lastSent}')">상세조회</button>
                    ${inv.source === 'db' ? `<button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSentGroup('${inv.hotelId}', '${inv.month}')">발송취소</button>` : ''}
                </td>
            </tr>`;
        });
    }

    const paginationContainer = document.getElementById('adminPagination');
    if (paginationContainer) {
        paginationContainer.innerHTML = `
            <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeAdminSentPage(-1)" ${window.adminSentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                <span style="font-weight: 600; color: #64748b;">${window.adminSentPage} / ${totalPages || 1}</span>
                <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changeAdminSentPage(1)" ${window.adminSentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
            </div>
        `;
    }
};
