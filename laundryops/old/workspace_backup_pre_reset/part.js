
  if(!f.history) f.history = []; const existingIdx = f.history.findIndex(i => i.hotelId === hId && i.date === date);
  if(existingIdx > -1) f.history[existingIdx] = inv; else f.history.unshift(inv);

  saveData(); alert('저장되었습니다.'); document.getElementById('invoiceFormArea').style.display = 'none'; window.loadStaffInvoiceList();
};

window.printReport = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    const printContent = el.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { border: 1px solid #ccc; padding: 8px; text-align: center; background: #eee; }
            td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        ${printContent}
    </body>
    </html>`);
    printWindow.document.close();
};

window.viewInvoiceDetail = function(id) {
    const f = platformData.factories[currentFactoryId];
    const inv = (f.history || []).find(i => i.id == id);
    if(!inv) { alert('데이터를 찾을 수 없습니다.'); return; }

    const h = f.hotels[inv.hotelId];
    // [정렬 수정] 저장된 품목 리스트 순서에 맞게 명세서 항목 정렬
    if (h && h.items) {
        const orderMap = new Map();
        h.items.forEach((item, index) => orderMap.set(item.name, index));
        inv.items.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
    }

    const isSpecial = h && h.hotelType === 'special';
    const actualSum = (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const supplyPrice = actualSum;
    const vat = Math.floor(supplyPrice * 0.1);
    const total = supplyPrice + vat;
    
    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 이미지 스타일과 유사한 2단 구성
        const grouped = {};
        inv.items.forEach(it => {
            const cat = it.category || '기타';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(it);
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto;">
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${inv.hotelName})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">발행일: ${inv.date}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} 
            </div>
        </div>`;
    } else {
        // [일반거래처] 리스트 방식 디자인 적용
        reportHtml = `
        <div id="report-to-print" style="padding:20px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:15px; margin-bottom:20px; font-size:24px;">세탁 명세서 (${inv.hotelName})</h1>
            <div style="text-align: left; margin-bottom: 10px; color: #0f172a; font-size: 14px; font-weight: 700;">발행일: ${inv.date}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${(inv.items || []).map(it => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(it.price || 0).toLocaleString()}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${it.qty || 0}</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(Number(it.price || 0) * Number(it.qty || 0)).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">공급가 합계</td>
                        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">₩ ${actualSum.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:20px;">
        <button class="btn btn-neutral" onclick="printReport('report-to-print')" style="padding:10px 30px;">🖨️ 인쇄하기</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};

window.handleQtyKeydown = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.inv-qty'));
        const currentIndex = allInputs.indexOf(e.target);
        if (allInputs[currentIndex + 1]) {
            allInputs[currentIndex + 1].focus();
            allInputs[currentIndex + 1].select();
        } else {
            document.getElementById('btnSaveInvoice').focus();
        }
    }
};

window.updateTrendChartOnly = async function() {

  // 6개월 추이 데이터 준비
  const base = new Date(curMonth + "-01");
  for(let i=5; i>=0; i--) {
      const d = new Date(base); d.setMonth(d.getMonth() - i);
      monthlyTrend[d.toISOString().substring(0, 7)] = 0;
  }

  (f.history || []).forEach(inv => {
      const isFiltered = (filterId === 'all' || inv.hotelId === filterId);
      const hotelInfo = f.hotels[inv.hotelId];
      // If hotelInfo is missing, we assume it's not fixed-rate, but for revenue reporting, it should probably be excluded?
      // Actually, if hotelInfo is missing, the invoice data might be stale. Let's just skip it if hotelInfo is null.
      if (!hotelInfo) return;

      const isFixed = (hotelInfo.contractType && hotelInfo.contractType.trim() === 'fixed');
      if (inv.hotelName.includes('준모텔')) console.log('DEBUG 준모텔:', inv.hotelName, 'isFixed=', isFixed, 'contractType=', hotelInfo.contractType);

      // 정액제 거래처인 경우, 발생한 명세서 합계는 매출 통계에서 제외 (기록만 남김)
      if (isFixed) return;

      // Today's Revenue (Contextual)
      if(inv.date === today && isFiltered) todayRevFiltered += inv.total;

      // Overall Monthly Sales (For Ranking & Cards) - Only sum if NOT fixed-rate
      if(inv.date.startsWith(curMonth) && !isFixed) {
          const key = hotelInfo.name;
          allSalesForRanking[key] = (allSalesForRanking[key] || 0) + inv.total;
          monthlyRevTotal += inv.total;
      }

      // Filtered Monthly Sales & Trend (For Chart)
      if(inv.date.startsWith(curMonth) && isFiltered) {
          monthlyRevFiltered += inv.total;
          hotelSalesFiltered[inv.hotelName] = (hotelSalesFiltered[inv.hotelName] || 0) + inv.total;
      }

      // Monthly Trend aggregation
      const m = inv.date.substring(0, 7);
      if(monthlyTrend[m] !== undefined) monthlyTrend[m] += isFiltered ? inv.total : 0;
  });

  // [정액제 매출 반영 로직] - 모든 정액제 거래처의 계약 금액을 무조건 매출에 포함
  for (const hId in (f.hotels || {})) {
      const h = f.hotels[hId];
      if (h.contractType === 'fixed') {
          const fixedAmt = Number(h.fixedAmount || 0);
          monthlyRevTotal += fixedAmt;
          allSalesForRanking[h.name] = fixedAmt;

          // 월별 매출 추이에도 반영
          for (const m in monthlyTrend) {
              const isFiltered = (filterId === 'all' || filterId === hId);
              if (isFiltered) {
                  monthlyTrend[m] += fixedAmt;
              }
          }
      }
  }

  if(document.getElementById('adminTodayRevenue')) document.getElementById('adminTodayRevenue').innerText = todayRevFiltered.toLocaleString() + '원';
  if(document.getElementById('adminMonthlyRevenue')) document.getElementById('adminMonthlyRevenue').innerText = monthlyRevTotal.toLocaleString() + '원'; // Use Total
  if(document.getElementById('adminSummaryCount')) document.getElementById('adminSummaryCount').innerText = `${Object.keys(f.hotels || {}).length} / ${Object.keys(f.staffAccounts || {}).length}`;

  // --- 성장률 계산 (전월 대비) ---
  const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1).toISOString().substring(0, 7);
  let prevMonthRev = 0;

  // 전월 매출은 필터와 관계없이 전체 합계로 계산해야 함
  (f.history || []).filter(inv => inv.date.startsWith(prevMonth)).forEach(inv => {
      prevMonthRev += inv.total;
  });

  let growthRate = 0;
  if (prevMonthRev > 0) {
      growthRate = ((monthlyRevTotal - prevMonthRev) / prevMonthRev) * 100; // Use Total
  } else if (monthlyRevTotal > 0 && prevMonthRev === 0) {
      growthRate = 100;
  }

  if(document.getElementById('adminGrowthRate')) {
      let displayRate = growthRate.toFixed(1) + '%';
      if (growthRate >= 0) {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--success);">&#9650; ${displayRate}</span>`; // Upward triangle (Green/Primary)
      } else {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--danger);">&#9660; ${Math.abs(growthRate).toFixed(1)}%</span>`; // Downward triangle (Red)
      }
  }
  // -----------------------------

  // Populate dropdowns
  ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
      const select = document.getElementById(id);
      if(select) {
          const currentVal = select.value;
          select.innerHTML = '<option value="all">전체 거래처</option>';
          for(const hId in f.hotels) select.innerHTML += `<option value="${hId}">${f.hotels[hId].name}</option>`;
          select.value = currentVal || 'all';
      }
  });

  // [복구] 만료 15일 전 경고 모달 로직
  console.log("DEBUG: Checking payment modal. f.planExpiry =", f.planExpiry);
  if (f.planExpiry) {
      const expiryDate = new Date(f.planExpiry);
      const today = new Date();
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log("DEBUG: diffDays =", diffDays);
      
      const isPending = platformData.pendingPayments && platformData.pendingPayments.some(p => p.factoryId === currentFactoryId);
      console.log("DEBUG: isPending =", isPending);
      
      if (isPending) {
          if (!sessionStorage.getItem('paymentChecked')) {
              alert('입금 내역을 관리자가 확인중입니다.');
              sessionStorage.setItem('paymentChecked', 'true');
              showView('adminView', f.name + ' - 대표');
          }
      } else if (diffDays <= 15) {
          const msg = diffDays < 0 ? `이용 기간이 만료되었습니다. 결제를 진행해주세요.` : `이용 기간이 ${diffDays}일 남았습니다. 결제를 진행해주세요.`;
          const paymentMsgEl = document.getElementById('paymentMsg');
          if(paymentMsgEl) {
              paymentMsgEl.innerText = msg;
              console.log("DEBUG: Showing paymentModal with msg:", msg);
              openModal('paymentModal');
          } else {
              console.error("DEBUG: paymentMsg element not found!");
          }
      }
  } else {
      console.log("DEBUG: f.planExpiry is missing");
  }

  // Update Ranking Title dynamically
  const rankingTitle = document.getElementById('rankingTitle');
  if(rankingTitle) rankingTitle.innerText = `${curMonth.replace('-', '-')} 거래처 매출 TOP 10`;

  // **FIX APPLIED HERE: Ranking uses allSalesForRanking, independent of filterId**
  const rankingArea = document.getElementById('adminTopRankingArea');
  if(rankingArea) {
      rankingArea.innerHTML = '';
      rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
      Object.entries(allSalesForRanking).sort((a,b) => b[1]-a[1]).slice(0, 10).map((f, i) => `
          <tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f[1].toLocaleString()}원</td></tr>
      `).join('') + '</tbody></table>';
  }

  window.updateRevenueTrendChart(monthlyTrend, filterId === 'all' ? '전체' : (f.hotels[filterId] ? f.hotels[filterId].name : '선택 거래처'));
  window.loadAdminRecentInvoices();
};

window.updateRevenueTrendChart = function(data, lab) {
  const canvas = document.getElementById('revenueTrendChart');
  if(!canvas) return;
  if(revenueTrendChart) revenueTrendChart.destroy();
  revenueTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
          labels: Object.keys(data).map(m => m.substring(5) + '월'),
          datasets: [{ label: lab + ' 매출', data: Object.values(data), borderColor: '#005b9f', backgroundColor: 'rgba(0, 91, 159, 0.1)', fill: true, tension: 0.3 }]
      },
      options: { responsive: true, plugins: { legend: { display: true } } }
  });
};

window.loadAdminRecentInvoices = function(returnList = false) {
    const f = platformData.factories[currentFactoryId], tbody = document.getElementById('adminRecentInvoiceList');
    if(!f) return [];
    const hotelFilter = document.getElementById('adminStatsHotelFilter')?.value || 'all';
    const sDate = document.getElementById('adminStatsStartDate')?.value;
    const eDate = document.getElementById('adminStatsEndDate')?.value;

    let list = (f.history || []).filter(inv => hotelFilter === 'all' || inv.hotelId === hotelFilter);
    if(sDate) list = list.filter(inv => inv.date >= sDate);
    if(eDate) list = list.filter(inv => inv.date <= eDate);

    if(returnList) return list;

    const totalPages = Math.ceil(list.length / itemsPerPage);
    if(currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    if(tbody) {
        tbody.innerHTML = '';
        const paginatedList = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        paginatedList.forEach(inv => {
            const h = f.hotels[inv.hotelId];
            const contractType = h ? (h.contractType === 'fixed' ? '정액' : '단가') : '-';
            const badgeClass = h ? (h.contractType === 'fixed' ? 'badge-fixed' : 'badge-unit') : '';

            tbody.innerHTML += `<tr>
                <td>${inv.date}</td>
                <td><strong>${inv.hotelName}</strong></td>
                <td style="text-align:right;">${inv.total.toLocaleString()}원</td>
                <td><span class="badge ${badgeClass}">${contractType}</span></td>
                <td><span class="badge" style="background:${inv.isSent ? 'var(--success)' : '#cbd5e1'}">${inv.isSent ? '전송완료' : '미전송'}</span></td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:12px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px; margin-left:5px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });

        // 페이지네이션 컨트롤 (작고 예쁘게 수정)
        const paginationContainer = document.getElementById('adminPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = `
                <div style="margin-top: 20px; display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 13px;">
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
                    <span style="font-weight: 600; color: #64748b;">${currentPage} / ${totalPages || 1}</span>
                    <button class="btn btn-neutral" style="padding: 4px 10px; border-radius: 4px; border: 1px solid #ddd; background: #f8fafc; cursor: pointer;" onclick="changePage(1)" ${currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
                </div>
            `;
        }
    }
};

window.changePage = function(delta) {
    currentPage += delta;
    window.loadAdminRecentInvoices();
};

window.deleteInvoice = function(invId) {
    if(!confirm('정말 이 명세서를 삭제하시겠습니까?')) return;
    const f = platformData.factories[currentFactoryId];
    if(f && f.history) {
        f.history = f.history.filter(i => i.id != invId);
        saveData();
        loadAdminRecentInvoices();
        loadAdminDashboard();
        alert('삭제되었습니다.');
    }
};

window.checkInvoiceFilters = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    const sDate = document.getElementById('adminStatsStartDate');
    const eDate = document.getElementById('adminStatsEndDate');
    let isValid = true;
    [hotelFilter, sDate, eDate].forEach(el => {
        if(!el.value || el.value === 'all') { el.style.borderColor = 'red'; isValid = false; }
        else { el.style.borderColor = 'var(--border)'; }
    });
    return isValid;
};
window.exportInvoicesToPDF = function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    const f = platformData.factories[currentFactoryId];
    const h = f.hotels[hotelFilter];
    const isSpecial = h && h.hotelType === 'special';

    const list = window.loadAdminRecentInvoices(true).filter(inv => inv.date >= sDate && inv.date <= eDate);
    if(list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    // 일자별/품목별 데이터 집계
    const dailyData = {};
    const itemInfoMap = {}; // {name: {price, unit, category}}

    list.forEach(inv => {
        if (!inv.items) return; // defensive
        inv.items.forEach(it => {
            if (!it || !it.name) return; // defensive
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 카테고리별 2단 구성
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            // 일자별 수량 합계 계산
            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        // [일반거래처] 매트릭스 방식 디자인
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
