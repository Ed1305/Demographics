export type EmployeeStatus = 'active' | 'inactive';
export type UserRole = 'admin' | 'viewer';

export type CellValue = string | number | boolean | Date | null | undefined;

export interface Employee {
  startDate: CellValue;
  startDateObj?: Date | null;
  dob: CellValue;
  dobObj?: Date | null;
  name: string;
  team: string;
  age: number;
  gender: string;
  nationality: string;
  qualification: string;
  area: string;
  kids: CellValue;
  housing: string;
  experience: string;
  salaryExact: string;
  salaryBracket: string;
  source: string;
  status: EmployeeStatus;
}

export type StoredEmployee = Omit<Employee, 'startDateObj' | 'dobObj'>;

export interface StatusCounts {
  active: number;
  inactive: number;
}

export interface TeamRetentionCounts {
  total: number;
  active: number;
}

export interface AreaStats {
  active: number;
  inactive: number;
  total: number;
  tenures: number[];
}
