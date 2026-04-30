const ExcelJS = require('exceljs');
async function test() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Test');
    ws.columns = [{ width: 22 }, { width: 13 }, { width: 9 }, { width: 16 }];
    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = 'Title';
    ['품목', '단가(원)', '수량', '금액(원)'].forEach((v, i) => {
        ws.getCell(2, i + 1).value = v;
    });
    await wb.xlsx.writeFile('test.xlsx');
    console.log("Written");
}
test();
