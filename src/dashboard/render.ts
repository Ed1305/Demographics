import { BRANCH_TEAMS, getBranch } from '../constants';
import { SALARY_BRACKETS, TENURE_DAY_LABELS } from '../config';
import { setDashboardVisible } from '../app/layout';
import {
  renderGenderChart,
  renderSalaryChart,
  renderSourceChart,
  renderTeamChart,
  renderTenureChart,
} from '../charts/manager';
import { appState, getReportMonthKey } from '../state';
import { computeTenureDays, formatDate, formatEmployeeStartDate } from '../utils/date';
import { getById, getSelectValue, setSelectValue, unique } from '../utils/dom';
import type { AreaStats, Employee, StatusCounts, TeamRetentionCounts } from '../types';

function getFilteredData(): Employee[] {
  const branch = getSelectValue('branchFilter') || 'All';
  const status = getSelectValue('statusFilter') || 'ALL';
  const team = getSelectValue('teamFilter') || 'ALL';
  const source = getSelectValue('sourceFilter') || 'ALL';
  const gender = getSelectValue('genderFilter') || 'ALL';
  const area = getSelectValue('areaFilter') || 'ALL';

  return appState.currentData.filter((employee) => {
    if (branch !== 'All' && getBranch(employee.team) !== branch) return false;
    if (status !== 'ALL' && employee.status !== status) return false;
    if (team !== 'ALL' && employee.team !== team) return false;
    if (source !== 'ALL' && employee.source !== source) return false;
    if (gender !== 'ALL' && employee.gender !== gender) return false;
    if (area !== 'ALL' && employee.area !== area) return false;
    return true;
  });
}

export function updateTeamOptions(): void {
  const branch = getSelectValue('branchFilter');
  let teamsInBranch: string[] = [];

  if (branch === 'All') {
    teamsInBranch = unique(appState.currentData.map((d) => d.team)).sort();
  } else {
    const teamList = BRANCH_TEAMS[branch] || [];
    if (branch === 'Other') {
      const allTeams = unique(appState.currentData.map((d) => d.team));
      teamsInBranch = allTeams.filter((team) => getBranch(team) === 'Other');
    } else {
      teamsInBranch = teamList.filter((team) => appState.currentData.some((d) => d.team === team));
    }
  }

  const teamSelect = getById<HTMLSelectElement>('teamFilter');
  teamSelect.innerHTML =
    '<option value="ALL">All Teams</option>' +
    teamsInBranch.map((team) => `<option value="${team}">${team}</option>`).join('');
}

export function resetAllFilters(): void {
  setSelectValue('branchFilter', 'All');
  setSelectValue('statusFilter', 'ALL');
  updateTeamOptions();
  setSelectValue('teamFilter', 'ALL');
  setSelectValue('sourceFilter', 'ALL');
  setSelectValue('genderFilter', 'ALL');
  setSelectValue('areaFilter', 'ALL');
  applyFilters();
}

function bindFilterEvents(): void {
  getById<HTMLSelectElement>('branchFilter').addEventListener('change', updateTeamOptions);
  getById<HTMLSelectElement>('branchFilter').addEventListener('change', applyFilters);
  getById<HTMLSelectElement>('statusFilter').addEventListener('change', applyFilters);
  getById<HTMLSelectElement>('teamFilter').addEventListener('change', applyFilters);
  getById<HTMLSelectElement>('sourceFilter').addEventListener('change', applyFilters);
  getById<HTMLSelectElement>('genderFilter').addEventListener('change', applyFilters);
  getById<HTMLSelectElement>('areaFilter').addEventListener('change', applyFilters);
  getById<HTMLButtonElement>('resetFilters').addEventListener('click', resetAllFilters);
}

export function renderDashboard(data: Employee[]): void {
  setDashboardVisible(true);
  getById<HTMLDivElement>('filterBar').style.display = 'flex';

  const branches = unique(data.map((d) => getBranch(d.team))).sort();
  branches.unshift('All');

  const filterBar = getById<HTMLDivElement>('filterBar');
  filterBar.innerHTML = `
    <div class="filter-group"><label><i class="fas fa-code-branch"></i> Branch</label><select id="branchFilter">${branches.map((b) => `<option value="${b}">${b}</option>`).join('')}</select></div>
    <div class="filter-group"><label><i class="fas fa-toggle-on"></i> Status</label><select id="statusFilter"><option value="ALL">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    <div class="filter-group"><label>Team</label><select id="teamFilter"><option value="ALL">All Teams</option></select></div>
    <div class="filter-group"><label>Source</label><select id="sourceFilter"><option value="ALL">All Sources</option></select></div>
    <div class="filter-group"><label>Gender</label><select id="genderFilter"><option value="ALL">All Genders</option></select></div>
    <div class="filter-group"><label>Area</label><select id="areaFilter"><option value="ALL">All Areas</option></select></div>
    <button class="reset-btn" id="resetFilters" type="button"><i class="fas fa-undo-alt"></i> Reset</button>
  `;

  bindFilterEvents();

  const sources = unique(data.map((d) => d.source).filter(Boolean)).sort();
  const genders = unique(data.map((d) => d.gender).filter(Boolean)).sort();
  const areas = unique(data.map((d) => d.area).filter(Boolean)).sort();

  getById<HTMLSelectElement>('sourceFilter').innerHTML =
    '<option value="ALL">All Sources</option>' +
    sources.map((s) => `<option value="${s}">${s}</option>`).join('');
  getById<HTMLSelectElement>('genderFilter').innerHTML =
    '<option value="ALL">All Genders</option>' +
    genders.map((g) => `<option value="${g}">${g}</option>`).join('');
  getById<HTMLSelectElement>('areaFilter').innerHTML =
    '<option value="ALL">All Areas</option>' +
    areas.map((a) => `<option value="${a}">${a}</option>`).join('');

  updateTeamOptions();
  applyFilters();
}

export function applyFilters(): void {
  const filtered = getFilteredData();
  const total = filtered.length;
  const activeCount = filtered.filter((d) => d.status === 'active').length;
  const inactiveCount = filtered.filter((d) => d.status === 'inactive').length;
  const inactivePct = total ? ((inactiveCount / total) * 100).toFixed(1) : '0';
  const teamsCount = unique(filtered.map((d) => d.team)).length;
  const retentionRate = total ? ((activeCount / total) * 100).toFixed(1) : '0';

  const reportMonthKey = getReportMonthKey();

  const tenures = filtered
    .map((d) => computeTenureDays(d, reportMonthKey))
    .filter((t): t is number => t !== null && !Number.isNaN(t));
  const avgTenure = tenures.length
    ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length).toLocaleString()
    : 'N/A';

  getById<HTMLDivElement>('summaryCards').innerHTML = `
    <div class="card card--active"><div class="card-title"><i class="fas fa-user-check"></i> Active</div><div class="card-value">${activeCount}</div><div class="card-foot">${retentionRate}% retention</div></div>
    <div class="card card--inactive"><div class="card-title"><i class="fas fa-user-slash"></i> Inactive</div><div class="card-value">${inactiveCount}</div><div class="card-foot">${inactivePct}% of total</div></div>
    <div class="card card--total"><div class="card-title"><i class="fas fa-users"></i> Total</div><div class="card-value">${total}</div><div class="card-foot">${teamsCount} teams</div></div>
    <div class="card card--age"><div class="card-title"><i class="fas fa-calendar-week"></i> Avg Age</div><div class="card-value">${(filtered.reduce((acc, d) => acc + (+d.age || 0), 0) / total || 0).toFixed(1)}</div><div class="card-foot">years</div></div>
    <div class="card card--tenure"><div class="card-title"><i class="fas fa-hourglass-half"></i> Avg Tenure</div><div class="card-value">${avgTenure}</div><div class="card-foot">days</div></div>
  `;

  const srcGroups: Record<string, StatusCounts> = {};
  filtered.forEach((d) => {
    if (!srcGroups[d.source]) srcGroups[d.source] = { active: 0, inactive: 0 };
    srcGroups[d.source][d.status]++;
  });
  const srcLabels = Object.keys(srcGroups).sort();
  renderSourceChart(
    srcLabels,
    srcLabels.map((s) => srcGroups[s].active || 0),
    srcLabels.map((s) => srcGroups[s].inactive || 0),
  );

  const teamGroups: Record<string, StatusCounts> = {};
  filtered.forEach((d) => {
    if (!teamGroups[d.team]) teamGroups[d.team] = { active: 0, inactive: 0 };
    teamGroups[d.team][d.status]++;
  });
  const teamLabels = Object.keys(teamGroups).sort();
  renderTeamChart(
    teamLabels,
    teamLabels.map((t) => teamGroups[t].active || 0),
    teamLabels.map((t) => teamGroups[t].inactive || 0),
  );

  const genderCounts = { Female: 0, Male: 0, Other: 0 };
  filtered.forEach((d) => {
    if (d.gender === 'Female') genderCounts.Female++;
    else if (d.gender === 'Male') genderCounts.Male++;
    else genderCounts.Other++;
  });
  renderGenderChart(genderCounts.Female, genderCounts.Male, genderCounts.Other);

  const bracketCounts = SALARY_BRACKETS.map((b) =>
    filtered.filter((d) => d.status === 'active' && d.salaryBracket === b).length,
  );
  renderSalaryChart(SALARY_BRACKETS, bracketCounts);

  const tenureValues = filtered
    .map((d) => computeTenureDays(d, reportMonthKey))
    .filter((t): t is number => t !== null && !Number.isNaN(t));
  const tenureCounts = new Array(TENURE_DAY_LABELS.length).fill(0);
  tenureValues.forEach((days) => {
    if (days <= 90) tenureCounts[0]++;
    else if (days <= 180) tenureCounts[1]++;
    else if (days <= 365) tenureCounts[2]++;
    else if (days <= 730) tenureCounts[3]++;
    else if (days <= 1095) tenureCounts[4]++;
    else if (days <= 1825) tenureCounts[5]++;
    else tenureCounts[6]++;
  });
  renderTenureChart(TENURE_DAY_LABELS, tenureCounts);

  const teamRetMap: Record<string, TeamRetentionCounts> = {};
  filtered.forEach((d) => {
    if (!teamRetMap[d.team]) teamRetMap[d.team] = { total: 0, active: 0 };
    teamRetMap[d.team].total++;
    if (d.status === 'active') teamRetMap[d.team].active++;
  });
  const teamRows = Object.entries(teamRetMap).sort((a, b) => a[0].localeCompare(b[0]));
  getById<HTMLTableSectionElement>('teamRetentionBody').innerHTML = teamRows
    .map(([team, counts]) => {
      const retention = counts.total ? ((counts.active / counts.total) * 100).toFixed(1) : '0';
      return `<tr><td>${team}</td><td>${counts.total}</td><td>${counts.active}</td><td>${retention}%</td></tr>`;
    })
    .join('');

  const areaMap: Record<string, AreaStats> = {};
  filtered.forEach((d) => {
    if (!areaMap[d.area]) areaMap[d.area] = { active: 0, inactive: 0, total: 0, tenures: [] };
    areaMap[d.area][d.status]++;
    areaMap[d.area].total++;
    const tenure = computeTenureDays(d, reportMonthKey);
    if (tenure !== null) areaMap[d.area].tenures.push(tenure);
  });
  const areasSorted = Object.keys(areaMap).sort((a, b) => areaMap[b].total - areaMap[a].total);
  getById<HTMLTableSectionElement>('areaTableBody').innerHTML = areasSorted
    .map((area) => {
      const stats = areaMap[area];
      const inactPct = stats.total ? ((stats.inactive / stats.total) * 100).toFixed(1) : '0';
      const avgTenureArea = stats.tenures.length
        ? Math.round(stats.tenures.reduce((s, t) => s + t, 0) / stats.tenures.length).toLocaleString()
        : '—';
      const inactPctNum = Number(inactPct);
      const rateClass = inactPctNum >= 30 ? 'rate-high' : inactPctNum <= 10 ? 'rate-low' : '';
      return `<tr><td>${area}</td><td>${stats.total}</td><td>${stats.active}</td><td>${stats.inactive}</td><td><span class="badge-rate ${rateClass}">${inactPct}%</span></td><td>${avgTenureArea}</td><td>${inactPctNum > 30 ? '🔴 High' : inactPctNum > 15 ? '🟡 Moderate' : '🟢 Stable'}</td></tr>`;
    })
    .join('');

  getById<HTMLTableSectionElement>('employeeTableBody').innerHTML = filtered
    .map((d) => {
      const startStr = formatEmployeeStartDate(d);
      const dobStr = d.dobObj ? formatDate(d.dobObj) : d.dob ? String(d.dob).trim() : '—';
      const tenureDays = computeTenureDays(d, reportMonthKey);
      const tenureDisplay = tenureDays !== null && !Number.isNaN(tenureDays) ? `${tenureDays.toLocaleString()} days` : '—';
      return `<tr>
        <td>${d.name}</td><td>${d.team}</td><td>${d.age}</td><td>${dobStr}</td><td>${d.gender}</td><td>${d.area}</td><td>${d.kids}</td><td>${d.source}</td>
        <td>${startStr}</td><td>${tenureDisplay}</td>
        <td><span class="status-badge ${d.status}">${d.status}</span></td>
      </tr>`;
    })
    .join('');
}

export function clearDashboardView(): void {
  getById<HTMLDivElement>('filterBar').style.display = 'none';
  getById<HTMLDivElement>('summaryCards').innerHTML = '';
  getById<HTMLTableSectionElement>('teamRetentionBody').innerHTML = '';
  getById<HTMLTableSectionElement>('areaTableBody').innerHTML = '';
  getById<HTMLTableSectionElement>('employeeTableBody').innerHTML = '';
}
