const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');

// I notice the global notice bar is outside of `.app-container`.
// `style="display:none; background:#fee2e2; color:#991b1b; padding:10px; text-align:center; font-weight:700; border-bottom:1px solid #fecaca;"`
// Does it need to be inside `.app-container` or `.header`? 
// Actually, it should be fine. But let's check `display:none` and `loadGlobalNotice`
// `loadGlobalNotice` sets `bar.style.display = 'block';`

// Let's check `checkAdminExpired` or other views if they accidentally hide it.
