const MONTH_NAME_TO_NUM: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  sept: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function normalizeMonthToken(token: string): string {
  return token.trim().toLowerCase().replace(/[^a-z]/g, '');
}

function monthTokenToNumber(token: string): string | null {
  const normalized = normalizeMonthToken(token);
  return MONTH_NAME_TO_NUM[normalized] ?? null;
}

function formatDisplayMonth(year: string, monthNum: string): string {
  const monthIndex = parseInt(monthNum, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return `${MONTH_NAMES[0]} ${year}`;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function extractMonthFromFilename(filename: string): string | null {
  const baseName = filename.replace(/\.[^.]+$/, '');

  const namedMonth = baseName.match(
    /(?:^|[^a-zA-Z])(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[\s_\-.]+(20\d{2})/i,
  );
  if (namedMonth) {
    const monthNum = monthTokenToNumber(namedMonth[1]);
    if (monthNum) return formatDisplayMonth(namedMonth[2], monthNum);
  }

  const yearFirstNamed = baseName.match(
    /(20\d{2})[\s_\-.]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:[^a-zA-Z]|$)/i,
  );
  if (yearFirstNamed) {
    const monthNum = monthTokenToNumber(yearFirstNamed[2]);
    if (monthNum) return formatDisplayMonth(yearFirstNamed[1], monthNum);
  }

  const numericMonth = baseName.match(/(?:^|[^0-9])(20\d{2})[\s_\-.](0?[1-9]|1[0-2])(?:[^0-9]|$)/);
  if (numericMonth) {
    return formatDisplayMonth(numericMonth[1], numericMonth[2].padStart(2, '0'));
  }

  const numericMonthFirst = baseName.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[\s_\-.](20\d{2})(?:[^0-9]|$)/);
  if (numericMonthFirst) {
    return formatDisplayMonth(numericMonthFirst[2], numericMonthFirst[1].padStart(2, '0'));
  }

  const legacyMatch = filename.match(/([A-Za-z]+ \d{4})/);
  if (legacyMatch) {
    const parsed = parseUserMonthInput(legacyMatch[1]);
    if (parsed) return parsed;
  }

  return null;
}

export function parseUserMonthInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromFilename = extractMonthFromFilename(`${trimmed}.xlsx`);
  if (fromFilename) return fromFilename;

  const parts = trimmed.split(/[\s_\-./]+/).filter(Boolean);
  if (parts.length === 2) {
    const [first, second] = parts;
    const monthFromFirst = monthTokenToNumber(first);
    if (monthFromFirst && /^20\d{2}$/.test(second)) {
      return formatDisplayMonth(second, monthFromFirst);
    }
    const monthFromSecond = monthTokenToNumber(second);
    if (monthFromSecond && /^20\d{2}$/.test(first)) {
      return formatDisplayMonth(first, monthFromSecond);
    }
  }

  return null;
}

export function displayMonthToKey(display: string): string {
  const parsed = parseUserMonthInput(display);
  if (!parsed) return display.replace(/\s+/g, '_');

  const parts = parsed.split(/\s+/);
  const [monthName, year] = parts;
  const monthNum = monthTokenToNumber(monthName);
  return monthNum ? `${year}-${monthNum}` : display.replace(/\s+/g, '_');
}

export function keyToDisplayMonth(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, monthNum] = key.split('-');
    const monthIndex = parseInt(monthNum, 10) - 1;
    return monthIndex >= 0 && monthIndex < 12 ? `${MONTH_NAMES[monthIndex]} ${year}` : key;
  }

  const parsed = parseUserMonthInput(key.replace(/_/g, ' '));
  return parsed ?? key.replace(/_/g, ' ');
}

export function normalizeMonthKey(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) return key;
  return displayMonthToKey(key.replace(/_/g, ' '));
}

export function lastDayOfMonthKey(key: string): Date {
  const normalized = normalizeMonthKey(key);
  const [year, month] = normalized.split('-').map(Number);
  return new Date(year, month, 0);
}
