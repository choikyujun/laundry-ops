const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to add one `}` at line 1481 (which is index 1480 in lines array) to close `pageInvoices.forEach`
// No, `pageInvoices.forEach(inv => {` opened at L1471 [3].
// Closed at L1480 `});` [2]. This is correct.
// But `if (pageInvoices.length === 0) {` opened at L1467 [2] and `else {` opened at L1469 [2].
// Wait, `else` block at L1469 [2] NEVER closed!
// The `}` at L1498 closes `if(paginationDiv && count)`. Wait, no.
// L1484 `if(paginationDiv && count) {` -> closes at L1496 `} else if(paginationDiv) {` -> closes at L1498 `}`.
// So L1469 `else {` is still OPEN!
// L1499 `}` closes L1463 `else {`. Wait! 
// L1463 `else {` opened at [1]. L1499 `}` closes it down to [0].
// BUT L1469 `else {` opened at [2] and needs to be closed to [1]!
// Where is the `}` for L1469? It's missing!

// Let's replace:
/*
        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
  } // closing else
};
*/
// I see I added `} // closing else` at L1500 but somehow the brace count went to -1!
// Ah, `L1499 [1]:     }` closes L1469 `else {`. So now we are at [1].
// Then `L1500 [0]:   } // closing else` closes L1463 `else {`. So we are at [0].
// Then `L1501 [-1]: };` closes `window.loadAdminStaffList = async function() {`. So we are at [-1]!!!
// Why did we start at [0] for `window.loadAdminStaffList`? Because it opened at L1425 [0]! Wait, it started at 0 and ended at 0.
// If we end at -1, we have ONE TOO MANY CLOSING BRACES!

code = code.replace(/  \} \/\/ closing else\n\};\n\nwindow\.changeStaffPage \= function/g, '};\n\nwindow.changeStaffPage = function');

fs.writeFileSync('app_v38.js', code);
