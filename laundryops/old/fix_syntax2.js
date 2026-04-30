const fs = require('fs');
let lines = fs.readFileSync('app_v38.js', 'utf-8').split('\n');

let insideRemovedBlock = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('// [REMOVED_BY_DEDUPE] window.')) {
        insideRemovedBlock = true;
    }
    
    if (insideRemovedBlock) {
        if (!lines[i].startsWith('// ')) {
            lines[i] = '// ' + lines[i];
        }
        
        // Stop commenting when we hit the end of a block '};' at col 0
        if (lines[i] === '// };') {
            insideRemovedBlock = false;
        }
    }
}
fs.writeFileSync('app_v38.js', lines.join('\n'));
