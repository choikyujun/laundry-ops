const fs = require('fs');

let code = fs.readFileSync('app_v38.js', 'utf-8');

// I need to change the input in the deduct list to show numeric keypad.
// `<input type="text" class="deduct-qty-input" ...>` -> we can add `inputmode="numeric" pattern="[0-9\-]*" type="tel"` to force numpad on both iOS and Android.

code = code.replace(
    /<input type="text" class="deduct-qty-input" data-name="\$\{p\.name\}" placeholder="-0"/g,
    `<input type="tel" inputmode="numeric" pattern="[0-9\\-]*" class="deduct-qty-input" data-name="\${p.name}" placeholder="-0"`
);

fs.writeFileSync('app_v38.js', code);
