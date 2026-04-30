const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

const regex = /            activityBody\.innerHTML \+\= `<tr>\n\s*<td style="font-size:12px;">\$\{inv\.date\}<\/td>\n\s*<td>\$\{inv\.staff_name \|\| '직원'\}<\/td>\n\s*<td><strong>\$\{hName\}<\/strong><\/td>\n\s*<td style="text-align:right;">\$\{displaySum\.toLocaleString\(\)\}원<\/td>\n\s*<\/tr>`;\n\s*\};\n\s*\n\s*\/\/ \(페이징 버튼 렌더링 로직 유지\)/g;

// Notice L1479-1480: `</tr>`;\n        });`
// But we missed `}` to close `if (pageInvoices.length === 0) { ... } else {` block.
// Wait! `pageInvoices.forEach(inv => {` opened at L1471, and closed at L1480.
// But the `else` block opened at L1469. It needs to close.

code = code.replace(
    /            \}\n            pageHtml \+\= '<\/div>';\n            paginationDiv\.innerHTML \= pageHtml;\n        \} else if\(paginationDiv\) \{\n            paginationDiv\.innerHTML \= '';\n        \}\n    \}\n\};\n\nwindow\.changeStaffPage = function\(delta\)/g,
    `            }
            pageHtml += '</div>';
            paginationDiv.innerHTML = pageHtml;
        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
  } // closing else
};

window.changeStaffPage = function(delta)`
);

fs.writeFileSync('app_v38.js', code);
