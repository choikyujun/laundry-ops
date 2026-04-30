const list = [
  { invoice_items: [{ name: "A", qty: 1 }, { name: "", qty: 2 }] }
];
const itemInfoMap = {};
list.forEach(inv => (inv.invoice_items || []).forEach(it => {
    if (!it.name || it.name.trim() === '') return;
    if (!itemInfoMap[it.name]) itemInfoMap[it.name] = { price: Number(it.price||0) };
}));
console.log(itemInfoMap);
