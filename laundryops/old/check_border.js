const ExcelJS = require('exceljs');
async function test() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Test');
    ws.columns = [{ width: 22 }, { width: 13 }, { width: 9 }, { width: 16 }];
    ws.views = [{ showGridLines: false }];
    
    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = 'Title';
    
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    ws.getCell('A1').border = border;
    
    ws.getCell(2, 5).value = 'ghost'; // E column
    
    await wb.xlsx.writeFile('test2.xlsx');
    console.log("Written");
}
test();
