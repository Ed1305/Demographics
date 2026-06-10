import ExcelJS from 'exceljs';
import { formatDate as formatDateUtil } from '../utils/date';
import type { CellValue } from '../types';

export function extractCellValue(raw: ExcelJS.CellValue): CellValue {
  if (raw == null) return '';
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object') {
    if ('result' in raw) {
      const result = raw.result;
      if (result != null) return extractCellValue(result as ExcelJS.CellValue);
    }
    if ('text' in raw && typeof raw.text === 'string') return raw.text.trim();
    if ('richText' in raw && Array.isArray(raw.richText)) {
      return raw.richText.map((part) => part.text ?? '').join('').trim();
    }
    if ('hyperlink' in raw && typeof raw.hyperlink === 'string') {
      return raw.hyperlink.trim();
    }
  }
  return raw as CellValue;
}

export function getRowColumnCount(row: ExcelJS.Row): number {
  let max = 0;
  row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
    if (colNumber > max) max = colNumber;
  });
  return max;
}

export function getRowRawValues(row: ExcelJS.Row, columnCount?: number): CellValue[] {
  const count = columnCount ?? getRowColumnCount(row);
  if (count === 0) return [];

  const values: CellValue[] = Array.from({ length: count }, () => '');
  for (let col = 1; col <= count; col += 1) {
    values[col - 1] = extractCellValue(row.getCell(col).value);
  }
  return values;
}

export function getRowTextValues(row: ExcelJS.Row, columnCount?: number): string[] {
  return getRowRawValues(row, columnCount).map((value) => {
    if (value instanceof Date) return formatDateUtil(value);
    return value == null ? '' : String(value).trim();
  });
}

export function columnCountFromMap(map: Record<string, number | undefined>, headerCount: number): number {
  const indices = Object.values(map).filter((index): index is number => index !== undefined);
  if (indices.length === 0) return headerCount;
  return Math.max(headerCount, ...indices.map((index) => index + 1));
}

const EMPTY_ROW_STREAK_LIMIT = 8;
const MAX_SCAN_ROWS = 10000;

export function findDataEndRow(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columnCount: number,
  isDataRow: (rowValues: CellValue[]) => boolean,
  maxRow?: number,
): number {
  let lastDataRow = startRow - 1;
  let emptyStreak = 0;
  const scanLimit = Math.min(
    maxRow ?? Number.MAX_SAFE_INTEGER,
    sheet.rowCount || startRow + MAX_SCAN_ROWS,
    startRow + MAX_SCAN_ROWS,
  );
  const endRow = maxRow !== undefined ? Math.min(scanLimit, maxRow) : scanLimit;

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const rowValues = getRowRawValues(sheet.getRow(rowNumber), columnCount);

    if (isDataRow(rowValues)) {
      lastDataRow = rowNumber;
      emptyStreak = 0;
      continue;
    }

    emptyStreak += 1;
    if (emptyStreak >= EMPTY_ROW_STREAK_LIMIT && lastDataRow >= startRow) {
      break;
    }
  }

  return Math.max(lastDataRow, startRow);
}

export function getNameCellValue(rowValues: CellValue[], nameColumnIndex: number): string {
  return String(rowValues[nameColumnIndex] ?? '').trim();
}
