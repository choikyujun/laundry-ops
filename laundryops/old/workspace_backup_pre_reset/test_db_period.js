const fs = require('fs');

let codeP = fs.readFileSync('patch_partner_dashboard_v35.js', 'utf8');

// localSentMap 에 period가 제대로 들어갔는지 디버그 찍기
const oldLocalLogic = `                    if (month) {
                        if (!localSentMap[month] || new Date(localInv.sentAt) > new Date(localSentMap[month].sentAt)) {
                            localSentMap[month] = localInv;
                        }
                    }`;

const newLocalLogic = `                    if (month) {
                        if (!localSentMap[month] || new Date(localInv.sentAt) > new Date(localSentMap[month].sentAt)) {
                            localSentMap[month] = localInv;
                            console.log("DEBUG: Found local period for partner:", localInv.period);
                        }
                    }`;

codeP = codeP.replace(oldLocalLogic, newLocalLogic);

// dbGrouped 쪽에 할당할 때 디버그 찍기
const oldAssign = `const realPeriod = localSentMap[month] ? localSentMap[month].period : \`\${month}-01 ~ \${month}-\${lastDay}\`;`;
const newAssign = `const realPeriod = localSentMap[month] ? localSentMap[month].period : \`\${month}-01 ~ \${month}-\${lastDay}\`;
                    console.log("DEBUG: Partner Assigning period:", realPeriod, "localMap has:", !!localSentMap[month]);`;

codeP = codeP.replace(oldAssign, newAssign);
fs.writeFileSync('patch_partner_dashboard_v35.js', codeP);
console.log("Added debug logs");
