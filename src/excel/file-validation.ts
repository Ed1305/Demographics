const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function validateExcelFileMeta(file: File): void {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xlsm')) {
    throw new Error('Legacy .xls files are not supported. Open the file in Excel and save as .xlsx.');
  }

  if (file.size === 0) {
    throw new Error('The selected file is empty.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File is too large (max 50 MB).');
  }
}

export function validateExcelBuffer(buffer: ArrayBuffer, fileName: string): void {
  if (buffer.byteLength === 0) {
    throw new Error('The selected file is empty.');
  }

  const header = new Uint8Array(buffer.slice(0, 4));
  const isZip = header[0] === 0x50 && header[1] === 0x4b;
  const isOldXls =
    header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;

  if (isOldXls) {
    throw new Error(
      `"${fileName}" is an old .xls workbook. Open it in Excel and save as .xlsx, then upload again.`,
    );
  }

  if (!isZip) {
    throw new Error(
      `"${fileName}" does not look like a valid .xlsx file. Save as Excel Workbook (.xlsx) and try again.`,
    );
  }
}
