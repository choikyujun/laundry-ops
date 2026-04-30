const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// Replace the insert block in sendInvoicesToClient
const oldBlock = `
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)',
                    is_sent: true
                    // [중요 변경] DB에 없는 memo 컬럼을 빼고, 대신 author나 staff_name에 sent_log_id를 박제해버림.
                    // 이렇게 하면 DB 스키마 추가 없이도 "어떤 발송에 종속된 차감인지" 추적 가능!
                    // 예: staff_name = '관리자(차감)_로그ID'
                }]);
                
                // 삽입 후 staff_name 자체를 꼬리표로 덮어쓰기 업데이트
                await window.mySupabase.from('invoices').update({ staff_name: '관리자(차감)_' + newLog.id }).eq('id', invoiceId);
`;

const newBlock = `
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)_' + newLog.id,
                    is_sent: true
                }]);
`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('app_v38.js', code);
