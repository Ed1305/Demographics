import { validateExcelBuffer, validateExcelFileMeta } from './excel/file-validation';
import { parseWorkbookBuffer } from './excel/workbook-parser';
import type { Employee } from './types';

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  validateExcelFileMeta(file);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown read error';
    throw new Error(
      `Could not read "${file.name}". Close it in Excel if it is open, then choose the file again. (${detail})`,
    );
  }

  validateExcelBuffer(buffer, file.name);
  return buffer;
}

export async function readExcelBuffer(file: File): Promise<ArrayBuffer> {
  return readFileBuffer(file);
}

export async function parseExcelBuffer(buffer: ArrayBuffer, fileName = 'upload.xlsx'): Promise<Employee[]> {
  validateExcelBuffer(buffer, fileName);
  return parseWorkbookBuffer(buffer);
}

export async function parseExcel(file: File): Promise<Employee[]> {
  const buffer = await readFileBuffer(file);
  return parseWorkbookBuffer(buffer);
}
