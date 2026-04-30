// 팝업 모바일 넘침 방지
const fs = require('fs');
let code = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// replace 2단 양식 table container to have overflow-x
code = code.replace(/<div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">\s*<div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">\$\{cat\}<\/div>\s*<table/g, 
`<div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">\${cat}</div>
                <div style="overflow-x:auto;">
                <table`);

// close the div
code = code.replace(/<\/tbody>\s*<\/table>\s*<\/div>/g, 
`</tbody>
                </table>
                </div>
            </div>`);

// main wrapper
code = code.replace(/<div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto;">/g,
`<div id='sent-report-to-print' style="background: white; padding: 20px; font-family:'Malgun Gothic', sans-serif; max-width: 1000px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">`);

// grid for 2 columns -> change to repeat(auto-fit, minmax(300px, 1fr)) for mobile responsiveness
code = code.replace(/<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">/g, 
`<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px; align-items:start;">`);

fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', code);
console.log("Mobile grid patched in dashboard stats.");

let code2 = fs.readFileSync('patch_view_detail_single_all_items.js', 'utf8');
code2 = code2.replace(/<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; align-items:start;">/g, 
`<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px; align-items:start;">`);

code2 = code2.replace(/<div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">\s*<div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">\$\{cat\}<\/div>\s*<table/g, 
`<div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">\${cat}</div>
                <div style="overflow-x:auto;">
                <table`);

code2 = code2.replace(/<\/tbody>\s*<\/table>\s*<\/div>/g, 
`</tbody>
                </table>
                </div>
            </div>`);

fs.writeFileSync('patch_view_detail_single_all_items.js', code2);
console.log("Mobile grid patched in view details.");
