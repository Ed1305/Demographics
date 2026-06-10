import ExcelJS from 'exceljs';
import type { Employee } from '../types';
import { getRowTextValues } from './cell-utils';
import { detectRowRibbon } from './ribbon-detect';
import { parseRibbonSections, parseStaffSheet } from './sheet-parser';

export function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sheetNameMatches(sheet: ExcelJS.Worksheet, kind: 'active' | 'inactive'): boolean {
  const normalized = normalizeSheetName(sheet.name);
  const exact = kind === 'active' ? 'activestaff' : 'inactivestaff';

  if (normalized === exact || normalized.includes(exact)) return true;

  const hasStaffWord =
    normalized.includes('staff') ||
    normalized.includes('employee') ||
    normalized.includes('employees');

  if (kind === 'active') {
    if (normalized.includes('inactive')) return false;
    return (
      normalized.includes('active') &&
      (hasStaffWord || normalized === 'active' || normalized.endsWith('active'))
    );
  }

  return (
    normalized.includes('inactive') &&
    (hasStaffWord || normalized === 'inactive' || normalized.endsWith('inactive'))
  );
}

function findStaffSheet(workbook: ExcelJS.Workbook, kind: 'active' | 'inactive'): ExcelJS.Worksheet | null {
  const exact = kind === 'active' ? 'activestaff' : 'inactivestaff';

  const exactMatch = workbook.worksheets.find((sheet) => normalizeSheetName(sheet.name) === exact);
  if (exactMatch) return exactMatch;

  const containsMatch = workbook.worksheets.find((sheet) => normalizeSheetName(sheet.name).includes(exact));
  if (containsMatch) return containsMatch;

  return workbook.worksheets.find((sheet) => sheetNameMatches(sheet, kind)) ?? null;
}

function listSheetNames(workbook: ExcelJS.Workbook): string {
  return workbook.worksheets.map((sheet) => `"${sheet.name}"`).join(', ');
}

function detectStaffSheets(workbook: ExcelJS.Workbook): {
  activeSheet: ExcelJS.Worksheet;
  inactiveSheet: ExcelJS.Worksheet;
} | null {
  const activeSheet = findStaffSheet(workbook, 'active');
  const inactiveSheet = findStaffSheet(workbook, 'inactive');

  if (!activeSheet || !inactiveSheet || activeSheet.id === inactiveSheet.id) {
    return null;
  }

  return { activeSheet, inactiveSheet };
}

function parseMultiSheetWorkbook(
  activeSheet: ExcelJS.Worksheet,
  inactiveSheet: ExcelJS.Worksheet,
): Employee[] {
  const activeEmployees = parseStaffSheet(activeSheet, 'active');
  const inactiveEmployees = parseStaffSheet(inactiveSheet, 'inactive');

  if (activeEmployees.length + inactiveEmployees.length === 0) {
    throw new Error('No employee rows found on the "Active staff" and "Inactive staff" sheets.');
  }

  return [...activeEmployees, ...inactiveEmployees];
}

function findRibbonSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const sheet of workbook.worksheets) {
    let hasGreen = false;
    let hasRed = false;

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const ribbon = detectRowRibbon(row, getRowTextValues(row));
      if (ribbon === 'green') hasGreen = true;
      if (ribbon === 'red') hasRed = true;
    });

    if (hasGreen && hasRed) return sheet;
  }

  return null;
}

function tryParseStaffSheets(workbook: ExcelJS.Workbook): Employee[] | null {
  const staffSheets = detectStaffSheets(workbook);
  if (!staffSheets) return null;
  return parseMultiSheetWorkbook(staffSheets.activeSheet, staffSheets.inactiveSheet);
}

function tryParseTwoSheetFallback(workbook: ExcelJS.Workbook): Employee[] | null {
  if (workbook.worksheets.length < 2) return null;

  const [first, second] = workbook.worksheets;
  try {
    const activeEmployees = parseStaffSheet(first, 'active');
    const inactiveEmployees = parseStaffSheet(second, 'inactive');
    if (activeEmployees.length + inactiveEmployees.length === 0) return null;
    return [...activeEmployees, ...inactiveEmployees];
  } catch {
    return null;
  }
}

function tryParseRibbonWorkbook(workbook: ExcelJS.Workbook): Employee[] | null {
  const ribbonSheet = findRibbonSheet(workbook);
  if (!ribbonSheet) return null;

  try {
    return parseRibbonSections(ribbonSheet);
  } catch {
    return null;
  }
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Could not open the Excel file. Save it as .xlsx and try again. (${detail})`);
  }
  return workbook;
}

export async function parseWorkbookBuffer(buffer: ArrayBuffer): Promise<Employee[]> {
  const workbook = await loadWorkbook(buffer);

  if (workbook.worksheets.length === 0) {
    throw new Error('The Excel file has no worksheets.');
  }

  const attempts: Array<{ label: string; run: () => Employee[] | null }> = [
    { label: 'Active staff / Inactive staff sheets', run: () => tryParseStaffSheets(workbook) },
    { label: 'Green and red ribbon sections', run: () => tryParseRibbonWorkbook(workbook) },
    { label: 'First two worksheets as active/inactive', run: () => tryParseTwoSheetFallback(workbook) },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const result = attempt.run();
      if (result && result.length > 0) {
        return result;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${attempt.label}: ${message}`);
    }
  }

  const partialActive = findStaffSheet(workbook, 'active');
  const partialInactive = findStaffSheet(workbook, 'inactive');
  if (partialActive || partialInactive) {
    throw new Error(
      `Workbook must include both an Active staff sheet and an Inactive staff sheet. Found sheets: ${listSheetNames(workbook)}.`,
    );
  }

  const sheetList = listSheetNames(workbook);
  const detail = errors.length > 0 ? `\n\nDetails:\n- ${errors.join('\n- ')}` : '';
  throw new Error(
    `Could not parse the Excel file. Expected either separate "Active staff" / "Inactive staff" sheets, or one sheet with green/red header ribbons. Worksheets found: ${sheetList}.${detail}`,
  );
}
