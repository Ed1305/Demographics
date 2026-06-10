import ExcelJS from 'exceljs';
import { parseDateFromCell, formatDate as formatDateUtil } from '../utils/date';
import type { CellValue, Employee, EmployeeStatus } from '../types';
import {
  columnCountFromMap,
  findDataEndRow,
  getRowColumnCount,
  getRowRawValues,
  getRowTextValues,
} from './cell-utils';
import {
  buildColumnMap,
  type ColumnMap,
  normalizeHeader,
  validateColumnMap,
  validateRibbonSectionHeaders,
  validateStaffSheetHeaders,
} from './headers';
import { detectRibbonFromText, detectRowRibbon } from './ribbon-detect';

const BLOCKED_NAME_HEADERS = new Set([
  'names',
  'name',
  'employeename',
  'employeenames',
  'staffname',
  'fullname',
  'activestartdates',
  'inactivestartdates',
  'startdate',
  'startdates',
]);

function getCellValue(rowValues: CellValue[], index: number | undefined): CellValue {
  if (index === undefined) return '';
  return rowValues[index] ?? '';
}

function isLikelyHeaderName(name: string): boolean {
  return BLOCKED_NAME_HEADERS.has(normalizeHeader(name));
}

function isLikelyHeaderRow(textValues: string[]): boolean {
  if (detectRibbonFromText(textValues)) return true;

  const columnMap = buildColumnMap(textValues);
  return columnMap.name !== undefined && columnMap.startDate !== undefined;
}

function rowToEmployee(
  rowValues: CellValue[],
  columnMap: ColumnMap,
  status: EmployeeStatus,
): Employee | null {
  const name = String(getCellValue(rowValues, columnMap.name)).trim();
  if (!name || isLikelyHeaderName(name)) return null;

  const ageRaw = getCellValue(rowValues, columnMap.age);
  const kidsRaw = getCellValue(rowValues, columnMap.kids);

  const employee: Employee = {
    startDate: getCellValue(rowValues, columnMap.startDate),
    dob: getCellValue(rowValues, columnMap.dob),
    name,
    team: String(getCellValue(rowValues, columnMap.team)).trim(),
    age: parseInt(String(ageRaw), 10) || 0,
    gender: String(getCellValue(rowValues, columnMap.gender)).trim(),
    nationality: String(getCellValue(rowValues, columnMap.nationality)).trim(),
    qualification: String(getCellValue(rowValues, columnMap.qualification)).trim(),
    area: String(getCellValue(rowValues, columnMap.area)).trim(),
    kids: kidsRaw ?? 0,
    housing: String(getCellValue(rowValues, columnMap.housing)).trim(),
    experience: String(getCellValue(rowValues, columnMap.experience)).trim(),
    salaryExact: String(getCellValue(rowValues, columnMap.salaryExact)).trim(),
    salaryBracket: String(getCellValue(rowValues, columnMap.salaryBracket)).trim(),
    source: String(getCellValue(rowValues, columnMap.source)).trim(),
    status,
  };

  employee.startDateObj = parseDateFromCell(employee.startDate);
  employee.dobObj = parseDateFromCell(employee.dob);
  if (employee.startDateObj) {
    employee.startDate = formatDateUtil(employee.startDateObj);
  }
  if (employee.dobObj) {
    employee.dob = formatDateUtil(employee.dobObj);
  }
  return employee;
}

function parseDataRows(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columnMap: ColumnMap,
  status: EmployeeStatus,
  columnCount: number,
  maxRow?: number,
): Employee[] {
  const employees: Employee[] = [];
  const effectiveEndRow = findDataEndRow(sheet, startRow, columnCount, (rowValues) => {
      const textValues = rowValues.map((value) => {
        if (value instanceof Date) return formatDateUtil(value);
        return value == null ? '' : String(value).trim();
      });
      if (isLikelyHeaderRow(textValues)) return false;
      return rowToEmployee(rowValues, columnMap, status) !== null;
  }, maxRow);

  for (let rowNumber = startRow; rowNumber <= effectiveEndRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rowValues = getRowRawValues(row, columnCount);
    const textValues = rowValues.map((value) => {
      if (value instanceof Date) return formatDateUtil(value);
      return value == null ? '' : String(value).trim();
    });

    if (isLikelyHeaderRow(textValues)) continue;

    const employee = rowToEmployee(rowValues, columnMap, status);
    if (employee) employees.push(employee);
  }

  return employees;
}

function findStaffHeaderRow(sheet: ExcelJS.Worksheet, status: EmployeeStatus): number {
  let headerRow = -1;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRow !== -1) return;

    const textValues = getRowTextValues(row);
    const columnMap = buildColumnMap(textValues);
    if (columnMap.name !== undefined && columnMap.startDate !== undefined) {
      headerRow = rowNumber;
      return;
    }

    const normalizedHeaders = textValues.map(normalizeHeader);
    const joined = normalizedHeaders.join(' ');

    const ribbon = detectRowRibbon(row, textValues);
    if (status === 'active' && ribbon === 'green') {
      headerRow = rowNumber;
      return;
    }
    if (status === 'inactive' && ribbon === 'red') {
      headerRow = rowNumber;
      return;
    }

    if (status === 'active' && joined.includes('activestart')) {
      headerRow = rowNumber;
      return;
    }
    if (status === 'inactive' && joined.includes('inactivestart')) {
      headerRow = rowNumber;
    }
  });

  return headerRow;
}

export function parseStaffSheet(sheet: ExcelJS.Worksheet, status: EmployeeStatus): Employee[] {
  const headerRowNum = findStaffHeaderRow(sheet, status);
  if (headerRowNum === -1) {
    const columnLabel = status === 'active' ? 'Active Start Dates' : 'Inactive Start Dates';
    throw new Error(
      `Could not find a header row with Names and "${columnLabel}" (or "Start Date") on sheet "${sheet.name}".`,
    );
  }

  const headerRowObj = sheet.getRow(headerRowNum);
  const headerColumnCount = getRowColumnCount(headerRowObj);
  const headerTexts = getRowTextValues(headerRowObj, headerColumnCount);
  validateStaffSheetHeaders(headerTexts, status);

  const columnMap = buildColumnMap(headerTexts);
  validateColumnMap(columnMap, status, 'sheet');

  const columnCount = columnCountFromMap(columnMap, headerColumnCount);
  const employees = parseDataRows(sheet, headerRowNum + 1, columnMap, status, columnCount);

  if (employees.length === 0) {
    throw new Error(`No employee rows found on sheet "${sheet.name}".`);
  }

  return employees;
}

export function parseRibbonSections(sheet: ExcelJS.Worksheet): Employee[] {
  let activeHeaderRow = -1;
  let inactiveHeaderRow = -1;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const textValues = getRowTextValues(row);
    const ribbon = detectRowRibbon(row, textValues);
    if (ribbon === 'green' && activeHeaderRow === -1) activeHeaderRow = rowNumber;
    if (ribbon === 'red') inactiveHeaderRow = rowNumber;
  });

  if (activeHeaderRow === -1) {
    throw new Error(
      'Could not find the green Active header row. Expected a green ribbon with "Active Start Dates".',
    );
  }

  if (inactiveHeaderRow === -1) {
    throw new Error(
      'Could not find the red Inactive header row. Expected a red ribbon with "Inactive Start Dates".',
    );
  }

  if (inactiveHeaderRow <= activeHeaderRow) {
    throw new Error('The red Inactive header must appear below the green Active header.');
  }

  const activeHeaderRowObj = sheet.getRow(activeHeaderRow);
  const inactiveHeaderRowObj = sheet.getRow(inactiveHeaderRow);
  const activeColumnCount = getRowColumnCount(activeHeaderRowObj);
  const inactiveColumnCount = getRowColumnCount(inactiveHeaderRowObj);

  const activeHeaderTexts = getRowTextValues(activeHeaderRowObj, activeColumnCount);
  const inactiveHeaderTexts = getRowTextValues(inactiveHeaderRowObj, inactiveColumnCount);
  validateRibbonSectionHeaders(activeHeaderTexts, 'active');
  validateRibbonSectionHeaders(inactiveHeaderTexts, 'inactive');

  const activeColumnMap = buildColumnMap(activeHeaderTexts);
  const inactiveColumnMap = buildColumnMap(inactiveHeaderTexts);
  validateColumnMap(activeColumnMap, 'active', 'ribbon');
  validateColumnMap(inactiveColumnMap, 'inactive', 'ribbon');

  const activeEmployees = parseDataRows(
    sheet,
    activeHeaderRow + 1,
    activeColumnMap,
    'active',
    columnCountFromMap(activeColumnMap, activeColumnCount),
    inactiveHeaderRow - 1,
  );

  const inactiveEmployees = parseDataRows(
    sheet,
    inactiveHeaderRow + 1,
    inactiveColumnMap,
    'inactive',
    columnCountFromMap(inactiveColumnMap, inactiveColumnCount),
  );

  if (activeEmployees.length + inactiveEmployees.length === 0) {
    throw new Error('No employee rows found under the green and red header ribbons.');
  }

  return [...activeEmployees, ...inactiveEmployees];
}
