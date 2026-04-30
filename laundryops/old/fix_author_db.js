const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

const regex = /const \{ error: invErr \} = await window\.mySupabase\.from\('invoices'\)\.insert\(\[\{\n\s*id: invoiceId,\n\s*factory_id: currentFactoryId,\n\s*hotel_id: hotelFilter,\n\s*date: eDate, \n\s*total_amount: deductionAmount,\n\s*staff_name: '관리자\(차감\)',\n\s*author: '관리자\(차감\)',\n\s*is_sent: true\n[\s\S]*?\}\]\);\n\s*\/\/ 삽입 후 staff_name 자체를 꼬리표로 덮어쓰기 업데이트\n\s*await window\.mySupabase\.from\('invoices'\)\.update\(\{ staff_name: '관리자\(차감\)_' \+ newLog\.id \}\)\.eq\('id', invoiceId\);/g;

code = code.replace(regex, `const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)_' + newLog.id,
                    is_sent: true
                }]);`);

// Add an error throw to notify if invoice insertion failed
code = code.replace(
    /if\(\!invErr\) \{\n\s*const insertPayloads = window\._currentDeductions\.map/g,
    `if(invErr) {\n                    console.error("차감 명세서 생성 에러:", invErr);\n                    throw new Error("차감 명세서 생성 실패: " + invErr.message);\n                }\n                if(!invErr) {\n                    const insertPayloads = window._currentDeductions.map`
);

fs.writeFileSync('app_v38.js', code);
