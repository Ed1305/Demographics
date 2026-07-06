export const BRANCH_TEAMS: Record<string, string[]> = {
  Invnt: [
    'Team Prosper',
    'Team Chad',
    'Team Moses',
    'Team Sonwabile',
    'Team Anda',
    'Team Nombeko',
    'Invnt Incubation',
  ],
  Alpha: [
    'Team Popo',
    'Team Khaya',
    'Team Isipho',
    'Team Ayabonga',
    'Team Yolanda',
    'Alpha Incubation',
  ],
};

export const BRANCH_NAMES = ['Invnt', 'Alpha'] as const;
export type BranchName = (typeof BRANCH_NAMES)[number];

const CANONICAL_TEAMS = Object.values(BRANCH_TEAMS).flat();

const TEAM_ALIASES: Record<string, string> = {
  ayabanga: 'Team Ayabonga',
  ayabonga: 'Team Ayabonga',
  prosper: 'Team Prosper',
  chad: 'Team Chad',
  moses: 'Team Moses',
  sonwabile: 'Team Sonwabile',
  popo: 'Team Popo',
  khaya: 'Team Khaya',
  khayalethu: 'Team Khaya',
  isipho: 'Team Isipho',
  nombeko: 'Team Nombeko',
  anda: 'Team Anda',
  yolanda: 'Team Yolanda',
  'invnt incubation': 'Invnt Incubation',
  'alpha incubation': 'Alpha Incubation',
};

function normalizeTeamKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canonicalizeTeam(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  if (CANONICAL_TEAMS.includes(trimmed)) return trimmed;

  const key = normalizeTeamKey(trimmed);
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];

  const withoutTeam = key.replace(/^team\s+/, '');
  if (TEAM_ALIASES[withoutTeam]) return TEAM_ALIASES[withoutTeam];

  const withTeam = `Team ${trimmed.replace(/^team\s+/i, '')}`;
  if (CANONICAL_TEAMS.includes(withTeam)) return withTeam;

  if (/^team\s+/i.test(trimmed)) {
    const candidate = trimmed.replace(/\s+/g, ' ').replace(/^team\s+/i, 'Team ');
    if (CANONICAL_TEAMS.includes(candidate)) return candidate;
  }

  return trimmed.replace(/\s+/g, ' ').replace(/^team\s+/i, 'Team ').trim();
}

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
