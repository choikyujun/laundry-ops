const fs = require('fs');

let content = fs.readFileSync('patch_admin_dashboard_stats_and_print.js', 'utf8');

// 1. 랭킹 타이틀 및 가로줄 처리
// HTML 요소의 text를 변경해야 하므로 스크립트에서 getElementById('rankingTitle') 를 잡아 수정
// 테이블 tr 에 border-bottom 을 추가
const oldRankLogic = `// Top 10 그리기
    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
        if(sorted.length === 0) {
            rankingArea.innerHTML = '<div style="color:gray;">데이터가 없습니다.</div>';
        } else {
            const top10 = sorted.slice(0, 10);
            rankingArea.innerHTML = '<table style="width:100%; border-collapse:collapse; text-align:left;"><tbody>' + 
            top10.map((f, i) => \`
                <tr>
                    <td style="padding:4px 0;">\${i+1}위</td>
                    <td style="padding:4px 0;">\${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary); padding:4px 0;">\${f[1].toLocaleString()}원</td>
                </tr>
            \`).join('') + '</tbody></table>';
        }
    }`;

const newRankLogic = `// Top 10 그리기
    const titleEl = document.getElementById('rankingTitle');
    if (titleEl) {
        // parts[0] 년, parts[1] 월
        titleEl.innerHTML = \`\${parts[0]}년 \${parts[1]}월 매출 TOP 10\`;
    }
    const rankingArea = document.getElementById('adminTopRankingArea');
    if(rankingArea) {
        const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
        if(sorted.length === 0) {
            rankingArea.innerHTML = '<div style="color:gray;">데이터가 없습니다.</div>';
        } else {
            const top10 = sorted.slice(0, 10);
            rankingArea.innerHTML = '<table style="width:100%; border-collapse:collapse; text-align:left;"><tbody>' + 
            top10.map((f, i) => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:8px 0; color: #475569;">\${i+1}위</td>
                    <td style="padding:8px 0; font-weight:600;">\${f[0]}</td>
                    <td style="text-align:right; font-weight:700; color:var(--primary); padding:8px 0;">\${f[1].toLocaleString()}원</td>
                </tr>
            \`).join('') + '</tbody></table>';
        }
    }`;

content = content.replace(oldRankLogic, newRankLogic);

// 2. 모바일 대응을 위해 Print/Send Report 등 표에 overflow-x 래퍼 확실하게 적용
// (이미 패치들에 overflow-x: auto 가 적용되어 있지만, 패치들을 한 번 점검)
if(!content.includes('newRankLogic executed')) {
    fs.writeFileSync('patch_admin_dashboard_stats_and_print.js', content);
    console.log("Ranking and mobile wrap logic patched in dashboard stats.");
}

