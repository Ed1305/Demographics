import { stripRuntimeFields } from '../../src/utils/date';
import type { Employee, StoredEmployee } from '../../src/types';

export function sanitizeEmployee(employee: Employee): StoredEmployee {
  const { startDateObj: _startDateObj, dobObj: _dobObj, ...rest } = employee;
  return {
    ...rest,
    name: String(rest.name ?? '').trim(),
    team: String(rest.team ?? '').trim(),
    gender: String(rest.gender ?? '').trim(),
    nationality: String(rest.nationality ?? '').trim(),
    qualification: String(rest.qualification ?? '').trim(),
    area: String(rest.area ?? '').trim(),
    housing: String(rest.housing ?? '').trim(),
    experience: String(rest.experience ?? '').trim(),
    salaryExact: String(rest.salaryExact ?? '').trim(),
    salaryBracket: String(rest.salaryBracket ?? '').trim(),
    source: String(rest.source ?? '').trim(),
    startDate: rest.startDate ?? '',
    dob: rest.dob ?? '',
    kids: rest.kids ?? 0,
    age: Number.isFinite(rest.age) ? rest.age : 0,
    status: rest.status === 'inactive' ? 'inactive' : 'active',
  };
}

export function sanitizeEmployees(employees: Employee[]): StoredEmployee[] {
  return stripRuntimeFields(employees).map((employee) => sanitizeEmployee(employee as Employee));
}
