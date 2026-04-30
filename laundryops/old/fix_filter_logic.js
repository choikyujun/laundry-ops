const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// The list filtering in viewSentDetail uses sentLogId.
// Let's check how the invoice is inserted:
// staff_name: '관리자(차감)_' + newLog.id
// And how it's filtered:
// return inv.staff_name === '관리자(차감)_' + sentLogId;

// However, looking at the DB output, the invoice created at 02:44 has staff_name: '관리자(차감)'.
// It seems the old code ran during that test. 
// Wait, the DB shows an invoice from '2026-04-20' with '관리자(차감)'.
// If the new code is running, it should insert '관리자(차감)_' + newLog.id.
