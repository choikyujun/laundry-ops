const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');
const lines = code.split('\n');

// Missing brace at L1499!
// L1499 [2]:     }  (closes `if(pageInvoices.length === 0) { ... } else {` block!)
// Then L1500 [1]:   } // closes `if(iErr) { ... } else {` block!
// Then L1501 [0]: }; // closes `window.loadAdminStaffList = async function() {`

code = code.replace(
    /        } else if\(paginationDiv\) {\n            paginationDiv\.innerHTML = '';\n        }\n    }\n};\n\nwindow\.changeStaffPage = function\(delta\)/g,
    `        } else if(paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } // closes inner else
  } // closes outer else
};

window.changeStaffPage = function(delta)`
);

fs.writeFileSync('app_v38.js', code);
