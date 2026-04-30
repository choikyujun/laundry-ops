const today = new Date();
const getTodayString = function() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };
console.log(getTodayString().substring(0, 7));
