import { colors, font } from '../styles/theme';

export const COMMON_COLORS = [
  '#2563eb', '#12b76a', '#f79009', '#7a5af8',
  '#0ea5e9', '#e11d48', '#14b8a6', '#f97316',
];

export function getCurveColor(chartDef, variableId, index) {
  return chartDef?.curveColors?.[variableId] || COMMON_COLORS[index % COMMON_COLORS.length];
}

export function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

export function createChartOptions(chartDef, variables, timeWindow = 30) {
  const varMap = new Map(variables.map((v) => [v.id, v]));
  const variableIds = chartDef.variableIds || [];

  const series = [
    {
      label: '时间',
      value: (u, v) => (v == null ? '--' : new Date(v * 1000).toLocaleTimeString('zh-CN', { hour12: false })),
    },
  ];

  variableIds.forEach((vid, idx) => {
    const v = varMap.get(vid);
    const color = getCurveColor(chartDef, vid, idx);
    series.push({
      label: v ? `${v.name}${v.unit ? ` (${v.unit})` : ''}` : vid,
      scale: 'y',
      stroke: color,
      width: 1.6,
      fill: variableIds.length === 1 ? `${color}1a` : null,
      points: { show: false },
      spanGaps: true,
    });
  });

  const yScale = {};
  const min = chartDef.yAxisMin;
  const max = chartDef.yAxisMax;
  const hasMin = min !== undefined && min !== null && min !== '';
  const hasMax = max !== undefined && max !== null && max !== '';
  if (hasMin || hasMax) {
    yScale.range = [
      hasMin ? Number(min) : null,
      hasMax ? Number(max) : null,
    ];
    yScale.auto = !(hasMin && hasMax);
  } else {
    yScale.auto = true;
  }

  return {
    width: 800,
    height: 300,
    series,
    legend: { show: false },
    cursor: {
      show: true,
      drag: { x: true, y: false },
    },
    select: { show: false },
    scales: {
      x: { time: true },
      y: yScale,
    },
    axes: [
      {
        scale: 'x',
        stroke: colors.textMuted,
        font: `11px ${font.family}`,
        values: (u, splits) => splits.map((v) =>
          new Date(v * 1000).toLocaleTimeString('zh-CN', { hour12: false })
        ),
        grid: { stroke: '#f2f4f7', width: 1 },
        ticks: { stroke: '#e4e7ec', width: 1, size: 4 },
        size: 34,
      },
      {
        scale: 'y',
        stroke: colors.textMuted,
        font: `11px ${font.family}`,
        grid: { stroke: '#f2f4f7', width: 1 },
        ticks: { stroke: '#e4e7ec', width: 1, size: 4 },
        size: 48,
      },
    ],
  };
}

/**
 * 将各变量缓冲数据转换为 uPlot 列数据（x 为秒）
 */
export function prepareChartData(bufferData, variableIds, timeWindow = 30) {
  const since = Date.now() - timeWindow * 1000;

  const timeSet = new Set();
  const byVariable = new Map();

  for (const vid of variableIds) {
    const rows = (bufferData.get(vid) || []).filter(
      (d) => d.timestamp >= since && d.value !== null && d.value !== undefined
    );
    const map = new Map();
    for (const row of rows) {
      const ms = row.timestamp;
      map.set(ms, row.value);
      timeSet.add(ms);
    }
    byVariable.set(vid, map);
  }

  const timestamps = Array.from(timeSet).sort((a, b) => a - b);
  const x = timestamps.map((t) => t / 1000);
  const columns = [x];

  for (const vid of variableIds) {
    const map = byVariable.get(vid);
    columns.push(timestamps.map((t) => {
      const value = map.get(t);
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }));
  }

  return columns;
}
