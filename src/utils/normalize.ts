import { SALARY_BRACKETS } from '../config';
import { canonicalizeTeam } from '../teams';
import type { Employee } from '../types';

const GENDER_VALUES = new Set(['male', 'female', 'm', 'f', 'other']);
const HOUSING_VALUES = new Set([
  'renting',
  'family home',
  'family home ',
  'familyhome',
  'family home',
  'other',
  'shelter',
  'fimaly home',
  'family home',
]);
const QUALIFICATION_HINTS = [
  'matric',
  'grade',
  'diploma',
  'bachelor',
  'bechelor',
  'certificate',
  'n1',
  'n2',
  'n3',
  'n4',
  'n5',
  'n6',
  'ncv',
  'degree',
  'management',
  'engineering',
  'hospitality',
  'tourism',
  'law',
  'psychology',
  'education',
  'marketing',
  'financial',
  'business',
  'hr',
  'accounting',
  'web development',
  'sound',
  'logistics',
  'public',
  'clothing',
  'electrical',
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function looksLikeGender(value: string): boolean {
  return GENDER_VALUES.has(normalizeKey(value));
}

function looksLikeQualification(value: string): boolean {
  const key = normalizeKey(value);
  if (!key || looksLikeGender(key)) return false;
  return QUALIFICATION_HINTS.some((hint) => key.includes(hint));
}

function looksLikeHousing(value: string): boolean {
  const key = normalizeKey(value);
  return HOUSING_VALUES.has(key) || key.includes('rent') || key.includes('family') || key.includes('shelter');
}

function looksLikeBracket(value: string): boolean {
  const key = normalizeKey(value).replace(/\s/g, '');
  if (!key) return false;
  return SALARY_BRACKETS.some((b) => normalizeKey(b).replace(/\s/g, '') === key) || /^r?\d/.test(key);
}

function parseSalaryNumber(value: string): number | null {
  const cleaned = value.replace(/[r,\s]/gi, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'none') return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function normalizeSalaryBracket(raw: string, salaryExact = ''): string {
  let bracket = String(raw ?? '').trim();
  const exact = String(salaryExact ?? '').trim();

  if (looksLikeBracket(exact) && !looksLikeBracket(bracket) && parseSalaryNumber(exact) === null) {
    bracket = exact;
  }

  const key = normalizeKey(bracket).replace(/\s/g, '');
  if (!key || key === '0' || key === 'none') {
    const amount = parseSalaryNumber(exact);
    return amount !== null ? bracketFromAmount(amount) : '';
  }

  for (const canonical of SALARY_BRACKETS) {
    if (normalizeKey(canonical).replace(/\s/g, '') === key) return canonical;
  }

  const rangeMatch = key.match(/(\d+)\s*[-–to]+\s*r?\s*(\d+)/i);
  if (rangeMatch) {
    const low = Number.parseInt(rangeMatch[1], 10);
    const high = Number.parseInt(rangeMatch[2], 10);
    if (low <= 3000 && high <= 3000) return '0-R3000';
    if (low <= 6000 && high <= 6000) return 'R3001-R6000';
    if (low <= 8000 && high <= 8000) return 'R6001-R8000';
    if (high <= 14000) return 'R8001-R14000';
  }

  const amount = parseSalaryNumber(bracket);
  if (amount !== null) return bracketFromAmount(amount);

  return bracket;
}

export function normalizeSalaryExact(raw: string, salaryBracket = ''): string {
  let exact = String(raw ?? '').trim();
  const bracket = String(salaryBracket ?? '').trim();

  if (looksLikeBracket(exact) && parseSalaryNumber(exact) === null) {
    if (parseSalaryNumber(bracket) !== null) return bracket;
    return '';
  }

  if (exact.toLowerCase() === 'none') return '';

  const amount = parseSalaryNumber(exact);
  if (amount !== null) return String(Math.round(amount));

  return exact.replace(/^r\s*/i, '').trim();
}

function bracketFromAmount(amount: number): string {
  if (amount <= 3000) return '0-R3000';
  if (amount <= 6000) return 'R3001-R6000';
  if (amount <= 8000) return 'R6001-R8000';
  return 'R8001-R14000';
}

function repairSwappedGenderQualification(employee: Employee): void {
  const gender = String(employee.gender ?? '').trim();
  const qualification = String(employee.qualification ?? '').trim();

  if (looksLikeQualification(gender) && looksLikeGender(qualification)) {
    employee.gender = qualification;
    employee.qualification = gender;
    return;
  }

  if (looksLikeGender(qualification) && qualification === gender) {
    employee.qualification = '';
  }
}

function repairKidsHousingShift(employee: Employee): void {
  const kidsRaw = employee.kids;
  const kidsStr = String(kidsRaw ?? '').trim();

  if (!looksLikeHousing(kidsStr)) return;

  const housing = kidsStr;
  const experience = String(employee.housing ?? '').trim();
  const salaryFromExperience = String(employee.experience ?? '').trim();
  const bracketFromSalary = String(employee.salaryExact ?? '').trim();
  const sourceFromBracket = String(employee.salaryBracket ?? '').trim();

  employee.kids = 0;
  employee.housing = housing;
  employee.experience = looksLikeBracket(salaryFromExperience) ? '' : experience;

  if (looksLikeBracket(bracketFromSalary)) {
    employee.salaryExact = normalizeSalaryExact(salaryFromExperience, bracketFromSalary);
    employee.salaryBracket = normalizeSalaryBracket(bracketFromSalary, employee.salaryExact);
  } else if (parseSalaryNumber(salaryFromExperience) !== null) {
    employee.salaryExact = normalizeSalaryExact(salaryFromExperience);
    employee.salaryBracket = normalizeSalaryBracket(sourceFromBracket, employee.salaryExact);
  }

  if (sourceFromBracket && !looksLikeBracket(sourceFromBracket) && !employee.source) {
    employee.source = sourceFromBracket;
  }
}

function repairSalaryFields(employee: Employee): void {
  const exact = String(employee.salaryExact ?? '').trim();
  const bracket = String(employee.salaryBracket ?? '').trim();

  if (looksLikeBracket(exact) && parseSalaryNumber(bracket) !== null) {
    employee.salaryExact = normalizeSalaryExact(bracket, exact);
    employee.salaryBracket = normalizeSalaryBracket(exact, employee.salaryExact);
    return;
  }

  if (looksLikeBracket(exact) && !looksLikeBracket(bracket)) {
    employee.salaryBracket = normalizeSalaryBracket(exact, bracket);
    employee.salaryExact = normalizeSalaryExact(bracket, employee.salaryBracket);
    return;
  }

  employee.salaryExact = normalizeSalaryExact(exact, bracket);
  employee.salaryBracket = normalizeSalaryBracket(bracket, employee.salaryExact);
}

export function normalizeEmployee(employee: Employee): Employee {
  employee.team = canonicalizeTeam(employee.team);
  if (!employee.team) {
    employee.team = 'Invnt Incubation';
  }
  repairSwappedGenderQualification(employee);
  repairKidsHousingShift(employee);
  repairSalaryFields(employee);

  employee.gender = String(employee.gender ?? '').trim();
  employee.nationality = String(employee.nationality ?? '').trim();
  employee.qualification = String(employee.qualification ?? '').trim();
  employee.area = String(employee.area ?? '').trim();
  employee.housing = String(employee.housing ?? '').trim();
  employee.experience = String(employee.experience ?? '').trim();
  employee.source = String(employee.source ?? '').trim();

  const kidsNum = Number.parseInt(String(employee.kids ?? ''), 10);
  employee.kids = Number.isFinite(kidsNum) && kidsNum >= 0 ? kidsNum : 0;

  return employee;
}

export function normalizeEmployees(employees: Employee[]): Employee[] {
  return employees.map((employee) => normalizeEmployee({ ...employee }));
}
