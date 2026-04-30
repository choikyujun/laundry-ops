const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// In HTML table rendering:
code = code.replace(
    /<td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">\$\{it\.netQty\}<\/td>\n\s*\$\{globalHasDeduction \? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">\$\{it\.negQty < 0 \? it\.negQty : '0'\}<\/td>` : ''\}\n\s*<td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ \$\{\(it\.netQty \* it\.price\)\.toLocaleString\(\)\}<\/td>/g,
    `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">\${it.posQty}</td>
                                \${globalHasDeduction ? \`<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">\${it.negQty < 0 ? it.negQty : '0'}</td>\` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ \${(it.netQty * it.price).toLocaleString()}</td>`
);

// In Excel output (special hotel):
code = code.replace(
    /\? \[it\.name, it\.price, it\.netQty, it\.negQty \!\=\= 0 \? it\.negQty : '0', it\.price \* it\.netQty\]\n\s*: \[it\.name, it\.price, it\.netQty, it\.price \* it\.netQty\];/g,
    `? [it.name, it.price, it.posQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.posQty, it.price * it.netQty];`
);

fs.writeFileSync('app_v38.js', code);
