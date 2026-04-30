window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price)')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const supplyPrice = list.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (it.qty < 0) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    // ── 스타일 헬퍼 ──────────────────────────────────────────
    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        // ── 특수거래처 ─────────────────────────────────────
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        // 컬럼
        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        // 제목 행
        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            // 카테고리 헤더
            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            // 컬럼 헤더
            const headers = globalHasDeduction ? ['품목', '단가(원)', '차감', '수량(순)', '금액(원)'] : ['품목', '단가(원)', '수량(순)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.negQty !== 0 ? it.negQty : '0', it.netQty, it.price * it.netQty]
                    : [it.name, it.price, it.netQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 2 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; // 빈 행
        });

        // 공급가 / 부가세 / 총합계 행
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        // ── 일반거래처: 날짜 × 품목 매트릭스 ──────────────
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        // 제목
        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        // 기간
        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        // 헤더
        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                c.value = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                styleCell(c, { numFmt: '#,##0' });
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        // 총계 하단 안내
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
