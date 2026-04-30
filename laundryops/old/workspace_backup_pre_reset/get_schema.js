const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const appCode = fs.readFileSync('app_v46.js', 'utf-8');
const urlMatch = appCode.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = appCode.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
    console.log(urlMatch[1], keyMatch[1].substring(0,10));
}
