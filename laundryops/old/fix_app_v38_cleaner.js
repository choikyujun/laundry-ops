const fs = require('fs');

try {
    let code = fs.readFileSync('app_v38.js', 'utf-8');
    // If the file actually had syntax errors but wasn't caught, or somehow `login` wasn't assigned properly.
    // Wait, the browser says `ReferenceError: login is not defined`.
    // Let's check `거래명세서프로그램v38.html`.
    
    let html = fs.readFileSync('거래명세서프로그램v38.html', 'utf-8');
    console.log("HTML length:", html.length);
} catch(e) {
    console.error(e);
}
