export const BRANCH_TEAMS: Record<string, string[]> = {
  Invnt: ['Team Prosper', 'Team Chad', 'Team Moses', 'Team Sonwabile', 'Invnt Incubation'],
  Alpha: ['Team Popo', 'Team Khaya', 'Team Isipho', 'Team Ayabonga', 'Alpha Incubation'],
};

export function getBranch(team: string): string {
  for (const [branch, teams] of Object.entries(BRANCH_TEAMS)) {
    if (teams.includes(team)) return branch;
  }
  return 'Other';
}
