const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// Is the invoice missing entirely because the query has `.not('staff_name', 'like', '관리자(차감)%')` ???
// WAIT!! 
// In viewSentDetail, does the query have `.not`?
console.log(code.match(/window\.viewSentDetail = async function[\s\S]*?\.order\('date'/)[0]);

// Yes, wait, `app_v38.js` was modified with `code = code.replace(/\.neq\('staff_name',\s*'관리자\(차감\)'\)/g, ".not('staff_name', 'like', '관리자(차감)%')");`
// And `viewSentDetail` DID NOT HAVE `.neq('staff_name', ...)` initially.
// Let's verify `viewSentDetail` query.
