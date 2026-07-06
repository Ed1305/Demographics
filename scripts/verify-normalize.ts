import { readFileSync, existsSync } from 'fs';
import { parseExcelBuffer } from '../src/excel';
import { getBranch } from '../src/constants';
import { normalizeEmployees } from '../src/utils/normalize';
import { SALARY_BRACKETS } from '../src/config';

const files = [
  'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Jan_2026.xlsx',
  'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Feb_2026.xlsx',
  'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Mar_2026.xlsx',
  'C:/Users/ALPHA KONNECT/Downloads/January 2026.xlsx',
  'C:/Users/ALPHA KONNECT/Downloads/processed/2026-06-23T09-56-31-148Z__June 2026.xlsx',
];

let allOk = true;

for (const f of files) {
  const name = f.split(/[/\\]/).pop()!;
  if (!existsSync(f)) {
    console.log('SKIP', name);
    continue;
  }

  const buf = readFileSync(f);
  const parsed = await parseExcelBuffer(buf, name);
  const data = normalizeEmployees(parsed);

  const otherTeams = [...new Set(data.map((d) => d.team).filter((t) => t && getBranch(t) === 'Other'))];
  const emptyTeams = data.filter((d) => !d.team.trim()).length;
  const badBrackets = data.filter(
    (d) => d.status === 'active' && d.salaryBracket && !SALARY_BRACKETS.includes(d.salaryBracket as (typeof SALARY_BRACKETS)[number]),
  ).length;
  const zeroBrackets = data.filter((d) => d.salaryBracket === '0').length;
  const scrambledGender = data.filter((d) => d.qualification === d.gender && d.gender).length;

  const ok = otherTeams.length === 0 && badBrackets === 0 && zeroBrackets === 0 && scrambledGender === 0;
  if (!ok) allOk = false;

  console.log(`${ok ? '✓' : '✗'} ${name}: ${data.length} rows | Other: [${otherTeams.join(', ')}] | empty team: ${emptyTeams} | bad brackets: ${badBrackets} | "0": ${zeroBrackets} | qual=gender: ${scrambledGender}`);
}

process.exit(allOk ? 0 : 1);
