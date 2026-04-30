const fs = require('fs');
let code = fs.readFileSync('app_v38.js', 'utf-8');

// Replace the end of try-catch inside loadAdminRecentInvoices
const findStr = `    } catch (e) {
        console.error(e);
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color:red;">에러: \${e.message}</td></tr>\`;
    } finally {
        _isInvoiceLoading = false;
    }
};`;

const replaceStr = `    } catch (e) {
        console.error(e);
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; color:red;">에러: \${e.message}</td></tr>\`;
    } finally {
        _isInvoiceLoading = false;
    }
    if (returnList) return window._lastInvoiceData || [];
};`;

code = code.replace(findStr, replaceStr);

fs.writeFileSync('app_v38.js', code);
