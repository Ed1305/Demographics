import { readFileSync, existsSync } from 'fs';
import ExcelJS from 'exceljs';
import { buildColumnMap } from '../src/excel/headers';
import { getRowTextValues, getRowRawValues } from '../src/excel/cell-utils';
import { parseExcelBuffer } from '../src/excel';

const files = [
  ['2026-01', 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Jan_2026.xlsx'],
  ['2026-02', 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Feb_2026.xlsx'],
  ['2026-03', 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Mar_2026.xlsx'],
  ['2026-06', 'C:/Users/ALPHA KONNECT/Downloads/processed/2026-06-23T09-56-31-148Z__June 2026.xlsx'],
];

for (const [month, path] of files) {
  if (!existsSync(path)) {
    console.log(month, 'MISSING', path);
    continue;
  }
  const buf = readFileSync(path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  let headerRow: ExcelJS.Row | null = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (headerRow) return;
    const texts = getRowTextValues(row);
    if (texts.filter((t) => /salaries|salary/i.test(t)).length >= 2) {
      headerRow = row;
      console.log(`\n${month} headers:`, texts.join(' | '));
      console.log('  map:', JSON.stringify(buildColumnMap(texts)));
    }
  });

  const parsed = await parseExcelBuffer(buf, path);
  const withSalary = parsed.filter((e) => e.salaryExact || e.salaryBracket);
  const emptyBoth = parsed.filter((e) => !e.salaryExact && !e.salaryBracket);
  console.log(
    `${month} parsed: ${parsed.length} rows | with salary: ${withSalary.length} | empty both: ${emptyBoth.length}`,
  );
  if (withSalary[0]) {
    console.log('  sample:', withSalary[0].name, withSalary[0].salaryExact, '|', withSalary[0].salaryBracket);
  }
  if (emptyBoth[0]) {
    console.log('  empty sample:', emptyBoth[0].name);
  }
}
