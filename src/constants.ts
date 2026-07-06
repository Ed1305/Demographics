import { canonicalizeTeam } from './utils/normalize';

export const BRANCH_TEAMS: Record<string, string[]> = {
  Invnt: ['Team Prosper', 'Team Chad', 'Team Moses', 'Team Sonwabile', 'Invnt Incubation'],
  Alpha: [
    'Team Popo',
    'Team Khaya',
    'Team Isipho',
    'Team Ayabonga',
    'Team Nombeko',
    'Alpha Incubation',
  ],
};

export const BRANCH_NAMES = ['Invnt', 'Alpha'] as const;
export type BranchName = (typeof BRANCH_NAMES)[number];

export function getBranch(team: string): BranchName | 'Other' {
  const canonical = canonicalizeTeam(team);
  for (const [branch, teams] of Object.entries(BRANCH_TEAMS)) {
    if (teams.includes(canonical)) return branch as BranchName;
  }
  return 'Other';
}

export function isKnownBranch(branch: string): branch is BranchName {
  return BRANCH_NAMES.includes(branch as BranchName);
}
