import ExcelJS from 'exceljs';

export type RibbonType = 'green' | 'red';

function getCellFillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (!fill || fill.type !== 'pattern') return undefined;
  return fill.fgColor?.argb ?? fill.bgColor?.argb;
}

export function detectRibbonFromText(textValues: string[]): RibbonType | null {
  const joined = textValues.join(' ').toLowerCase();
  if (joined.includes('inactive start')) return 'red';
  if (joined.includes('active start')) return 'green';
  return null;
}

export function detectRibbonFromColor(row: ExcelJS.Row): RibbonType | null {
  let green = 0;
  let red = 0;

  row.eachCell({ includeEmpty: false }, (cell) => {
    const ribbon = classifyFill(getCellFillArgb(cell));
    if (ribbon === 'green') green += 1;
    if (ribbon === 'red') red += 1;
  });

  if (green >= 2 && green >= red) return 'green';
  if (red >= 2 && red > green) return 'red';
  if (green === 1 && red === 0) return 'green';
  if (red === 1 && green === 0) return 'red';
  return null;
}

export function detectRowRibbon(row: ExcelJS.Row, textValues: string[]): RibbonType | null {
  return detectRibbonFromText(textValues) ?? detectRibbonFromColor(row);
}

function classifyFill(argb?: string): RibbonType | null {
  const rgb = parseArgb(argb);
  if (!rgb) return null;

  const { r, g, b } = rgb;

  if (r > 245 && g > 245 && b > 245) return null;

  if (g >= 90 && g >= r + 25 && g >= b + 15) return 'green';
  if (r >= 140 && r >= g + 35 && r >= b + 20) return 'red';
  if (g >= 160 && g > r && g > b) return 'green';
  if (r >= 180 && r > g + 20) return 'red';

  return null;
}

function parseArgb(argb?: string): { r: number; g: number; b: number } | null {
  if (!argb) return null;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
