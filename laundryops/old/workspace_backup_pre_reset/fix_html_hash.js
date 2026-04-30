const fs = require('fs');

let html = fs.readFileSync('거래명세서프로그램v34.html', 'utf8');

// replace the static hash check in <head> to be IIFE (Immediately Invoked Function Expression) to bypass DOM loading issues.
html = html.replace(/\/\/ 해시 체크를 즉시 실행[\s\S]*?(?=<\/script>)/m, `
  // 해시 체크를 즉시 실행 (무조건 보여줌)
  (function() {
      // 1. 처음 화면 로드될 때 감지
      window.onload = function() {
          if (window.location.hash.includes('superadmin')) {
              const saOption = document.getElementById('saOption');
              if (saOption) {
                  saOption.style.display = 'block';
              }
          }
      };
      
      // 2. 주소창에서 엔터 치거나 뒤로가기 했을 때 감지
      window.onhashchange = function() {
          const saOption = document.getElementById('saOption');
          if (saOption) {
              if (window.location.hash.includes('superadmin')) {
                  saOption.style.display = 'block';
              } else {
                  saOption.style.display = 'none';
              }
          }
      };
  })();
`);

fs.writeFileSync('거래명세서프로그램v34.html', html);
console.log('HTML Hash script updated');
