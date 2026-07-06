import Chart from 'chart.js/auto';

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#64748b',
        font: { size: 12, family: 'Inter' },
        usePointStyle: true,
        boxWidth: 8,
      },
    },
  },
};

const barChartOptions = {
  ...baseChartOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#64748b', font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#eef2f6' },
      ticks: { color: '#64748b', font: { size: 11 } },
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
        { label: 'Active', data: active, backgroundColor: '#2a5298', borderRadius: 6 },
        { label: 'Inactive', data: inactive, backgroundColor: '#f87171', borderRadius: 6 },
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
        { label: 'Active', data: active, backgroundColor: '#2a5298', borderRadius: 6 },
        { label: 'Inactive', data: inactive, backgroundColor: '#f87171', borderRadius: 6 },
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
        backgroundColor: ['#ec4899', '#3b82f6', '#94a3b8'],
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
        backgroundColor: ['#fbbf24', '#f59e0b', '#d97706', '#b45309'],
        borderRadius: 8,
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
      datasets: [{ label: 'Employees', data: counts, backgroundColor: '#2a5298', borderRadius: 6 }],
    },
    options: barChartOptions,
  });
}
