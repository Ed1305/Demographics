import Chart from 'chart.js/auto';

const ORANGE = '#f26a21';
const PURPLE = '#8b7cf0';
const BLUE = '#5aa9e6';
const GOLD = '#e0a33c';
const MUTED = '#6f6d68';
const NEG = '#f4655f';
const GRID = 'rgba(255, 255, 255, 0.07)';
const TICK = '#8a8884';
const SURFACE = '#242322';
const TEXT = '#f3f2f0';
const BORDER = 'rgba(255, 255, 255, 0.14)';

const tooltipStyle = {
  backgroundColor: SURFACE,
  borderColor: BORDER,
  borderWidth: 1,
  titleColor: TEXT,
  bodyColor: TICK,
  titleFont: { size: 12, family: 'Inter', weight: 600 },
  bodyFont: { size: 12, family: 'Inter' },
  padding: 10,
  cornerRadius: 8,
  displayColors: true,
  usePointStyle: true,
  boxPadding: 4,
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: TICK,
        font: { size: 10.5, family: 'Inter' },
        usePointStyle: true,
        boxWidth: 7,
        padding: 14,
      },
    },
    tooltip: tooltipStyle,
  },
};

const barChartOptions = {
  ...baseChartOptions,
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: TICK, font: { size: 10.5, family: 'Inter' } },
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID, borderDash: [4, 4], drawTicks: false },
      border: { display: false },
      ticks: { color: TICK, font: { size: 10.5, family: 'Inter' }, padding: 8 },
    },
  },
};

let sourceChart: Chart | null = null;
let teamChart: Chart | null = null;
let genderChart: Chart | null = null;
let salaryChart: Chart | null = null;
let tenureChart: Chart | null = null;

export function clearCharts(): void {
  sourceChart?.destroy();
  teamChart?.destroy();
  genderChart?.destroy();
  salaryChart?.destroy();
  tenureChart?.destroy();
  sourceChart = teamChart = genderChart = salaryChart = tenureChart = null;
}

export function renderSourceChart(labels: string[], active: number[], inactive: number[]): void {
  sourceChart?.destroy();
  sourceChart = new Chart(document.getElementById('sourceChart') as HTMLCanvasElement, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Active', data: active, backgroundColor: ORANGE, borderRadius: 4, maxBarThickness: 28 },
        { label: 'Inactive', data: inactive, backgroundColor: NEG, borderRadius: 4, maxBarThickness: 28 },
      ],
    },
    options: barChartOptions,
  });
}

export function renderTeamChart(labels: string[], active: number[], inactive: number[]): void {
  teamChart?.destroy();
  teamChart = new Chart(document.getElementById('teamChart') as HTMLCanvasElement, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Active', data: active, backgroundColor: ORANGE, borderRadius: 4, maxBarThickness: 28 },
        { label: 'Inactive', data: inactive, backgroundColor: NEG, borderRadius: 4, maxBarThickness: 28 },
      ],
    },
    options: barChartOptions,
  });
}

export function renderGenderChart(female: number, male: number, other: number): void {
  genderChart?.destroy();
  genderChart = new Chart(document.getElementById('genderChart') as HTMLCanvasElement, {
    type: 'doughnut',
    data: {
      labels: ['Female', 'Male', 'Other'],
      datasets: [{
        data: [female, male, other],
        backgroundColor: [ORANGE, PURPLE, MUTED],
        borderWidth: 0,
      }],
    },
    options: baseChartOptions,
  });
}

export function renderSalaryChart(labels: readonly string[], counts: number[]): void {
  salaryChart?.destroy();
  salaryChart = new Chart(document.getElementById('salaryChart') as HTMLCanvasElement, {
    type: 'bar',
    data: {
      labels: [...labels],
      datasets: [{
        label: 'Active employees',
        data: counts,
        backgroundColor: [ORANGE, PURPLE, BLUE, GOLD],
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    },
    options: barChartOptions,
  });
}

export function renderTenureChart(labels: readonly string[], counts: number[]): void {
  tenureChart?.destroy();
  tenureChart = new Chart(document.getElementById('tenureChart') as HTMLCanvasElement, {
    type: 'bar',
    data: {
      labels: [...labels],
      datasets: [{ label: 'Employees', data: counts, backgroundColor: ORANGE, borderRadius: 4, maxBarThickness: 28 }],
    },
    options: barChartOptions,
  });
}
