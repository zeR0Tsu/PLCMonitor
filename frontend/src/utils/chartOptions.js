export const COMMON_COLORS = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
  '#E91E63', '#3F51B5', '#009688', '#FFC107',
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
    series.push({
      label: v ? `${v.name}${v.unit ? ` (${v.unit})` : ''}` : vid,
      scale: 'y',
      stroke: getCurveColor(chartDef, vid, idx),
      width: 2,
      fill: `${getCurveColor(chartDef, vid, idx)}20`,
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
        label: '时间',
        stroke: '#999',
        values: (u, splits) => splits.map((v) =>
          new Date(v * 1000).toLocaleTimeString('zh-CN', { hour12: false })
        ),
        grid: { stroke: 'rgba(0,0,0,0.08)', width: 1 },
        ticks: { stroke: 'rgba(0,0,0,0.1)', width: 1 },
        size: 60,
      },
      {
        scale: 'y',
        label: '数值',
        stroke: '#999',
        grid: { stroke: 'rgba(0,0,0,0.08)', width: 1 },
        ticks: { stroke: 'rgba(0,0,0,0.1)', width: 1 },
        size: 60,
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
