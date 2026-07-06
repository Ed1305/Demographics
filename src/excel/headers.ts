export type EmployeeField =
  | 'startDate'
  | 'name'
  | 'team'
  | 'age'
  | 'dob'
  | 'gender'
  | 'nationality'
  | 'qualification'
  | 'area'
  | 'kids'
  | 'housing'
  | 'experience'
  | 'salaryExact'
  | 'salaryBracket'
  | 'source';

export type ColumnMap = Partial<Record<EmployeeField, number>>;

export function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_FIELDS: Record<string, EmployeeField> = {
  activestartdates: 'startDate',
  inactivestartdates: 'startDate',
  startdate: 'startDate',
  names: 'name',
  name: 'name',
  employeename: 'name',
  employeenames: 'name',
  staffname: 'name',
  fullname: 'name',
  team: 'team',
  age: 'age',
  dob: 'dob',
  dateofbirth: 'dob',
  gender: 'gender',
  geneder: 'gender',
  nationality: 'nationality',
  qualification: 'qualification',
  area: 'area',
  kids: 'kids',
  rentingfamilyhome: 'housing',
  rentingfamilyhon: 'housing',
  renting: 'housing',
  housing: 'housing',
  experience: 'experience',
  source: 'source',
};

const SKIP_HEADERS = new Set(['status', 'resigned', 'terminated']);

export function resolveHeaderField(headerText: string, salaryIndex: () => number): EmployeeField | null {
  const normalized = normalizeHeader(headerText);
  if (!normalized) return null;

  if (SKIP_HEADERS.has(normalized)) return null;

  if (normalized.startsWith('activestart') || normalized.startsWith('inactivestart')) {
    return 'startDate';
  }

  if (
    normalized === 'startdates' ||
    normalized === 'startdate' ||
    normalized.endsWith('startdate') ||
    normalized.includes('startdate')
  ) {
    return 'startDate';
  }

  if (normalized === 'salaries' || normalized === 'salary') {
    const index = salaryIndex();
    if (index === 1) return 'salaryExact';
    if (index === 2) return 'salaryBracket';
    return 'salaryExact';
  }

  if (normalized.startsWith('salary')) {
    if (normalized.includes('bracket') || normalized.includes('range')) return 'salaryBracket';
    return 'salaryExact';
  }

  return HEADER_FIELDS[normalized] ?? null;
}

export function buildColumnMap(headerTexts: string[]): ColumnMap {
  const map: ColumnMap = {};
  let salaryCount = 0;

  headerTexts.forEach((header, index) => {
    const field = resolveHeaderField(header, () => {
      salaryCount += 1;
      return salaryCount;
    });
    if (field && map[field] === undefined) {
      map[field] = index;
    }
  });

  return map;
}

export function validateColumnMap(
  map: ColumnMap,
  ribbon: 'active' | 'inactive',
  context: 'ribbon' | 'sheet' = 'ribbon',
): void {
  if (map.name === undefined) {
    throw new Error('Could not find a "Names" column in the header row.');
  }
  if (map.startDate === undefined) {
    const label = ribbon === 'active' ? 'Active Start Dates' : 'Inactive Start Dates';
    if (context === 'sheet') {
      const sheetLabel = ribbon === 'active' ? 'Active staff' : 'Inactive staff';
      throw new Error(
        `Could not find a start date column ("${label}" or "Start Date") on the "${sheetLabel}" sheet.`,
      );
    }
    throw new Error(`Could not find "${label}" in the ${ribbon === 'active' ? 'green' : 'red'} header row.`);
  }
}

/** Strict check for combined green/red ribbon on a single worksheet. */
export function validateRibbonSectionHeaders(headerTexts: string[], ribbon: 'active' | 'inactive'): void {
  const columnMap = buildColumnMap(headerTexts);
  if (columnMap.startDate !== undefined) {
    const normalized = headerTexts.map(normalizeHeader).join(' ');
    if (ribbon === 'active' && (normalized.includes('activestart') || normalized.includes('startdate'))) {
      return;
    }
    if (ribbon === 'inactive' && (normalized.includes('inactivestart') || normalized.includes('startdate'))) {
      return;
    }
  }

  const normalized = headerTexts.map(normalizeHeader).join(' ');
  if (ribbon === 'active' && !normalized.includes('activestart') && !normalized.includes('startdate')) {
    throw new Error('Green ribbon must include an "Active Start Dates" or "Start Date" column.');
  }
  if (ribbon === 'inactive' && !normalized.includes('inactivestart') && !normalized.includes('startdate')) {
    throw new Error('Red ribbon must include an "Inactive Start Dates" or "Start Date" column.');
  }
}

/** @deprecated Use validateRibbonSectionHeaders or validateStaffSheetHeaders */
export function validateRibbonHeaders(headerTexts: string[], ribbon: 'active' | 'inactive'): void {
  validateRibbonSectionHeaders(headerTexts, ribbon);
}

export function validateStaffSheetHeaders(headerTexts: string[], status: 'active' | 'inactive'): void {
  const columnMap = buildColumnMap(headerTexts);
  validateColumnMap(columnMap, status, 'sheet');
}
