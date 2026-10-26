import { chartPalettes, font } from '../styles/theme';

const DEFAULT_PALETTE = chartPalettes.light;

export function getCurveColor(chartDef, variableId, index, palette = DEFAULT_PALETTE) {
  return chartDef?.curveColors?.[variableId] || palette.colors[index % palette.colors.length];
}

export function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * 单个坐标轴面板的 uPlot 配置
 * @param {object} chartDef 图表定义
 * @param {Array} variables 变量定义
 * @param {object} axis { variableIds, min, max }
 * @param {object} palette chartPalettes.light / dark
 */
export function createChartOptions(chartDef, variables, axis = {}, palette = DEFAULT_PALETTE) {
  const varMap = new Map((variables || []).map((v) => [v.id, v]));
  const variableIds = axis.variableIds || chartDef.variableIds || [];

  const series = [
    {
      label: '时间',
      value: (u, v) => (v == null ? '--' : new Date(v * 1000).toLocaleTimeString('zh-CN', { hour12: false })),
    },
  ];

  variableIds.forEach((vid, idx) => {
    const variable = varMap.get(vid);
    const color = getCurveColor(chartDef, vid, idx, palette);
    series.push({
      label: variable ? `${variable.name}${variable.unit ? ` (${variable.unit})` : ''}` : vid,
      scale: 'y',
      stroke: color,
      width: 1.6,
      fill: variableIds.length === 1 ? `${color}1f` : null,
      points: { show: false },
      spanGaps: true,
    });
  });

  const min = toNumberOrNull(axis.min);
  const max = toNumberOrNull(axis.max);
  const yScale = { auto: true };
  if (min !== null || max !== null) {
    yScale.range = [min, max];
    yScale.auto = min === null || max === null;
  }

  return {
    width: 800,
    height: 260,
    series,
    legend: { show: false },
    cursor: {
      show: true,
      drag: { x: true, y: false },
      points: { size: 5, stroke: palette.cursor },
    },
    select: { show: false },
    scales: {
      x: { time: true },
      y: yScale,
    },
    axes: [
      {
        scale: 'x',
        stroke: palette.axis,
        font: `11px ${font.family}`,
        incrs: [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600],
        values: (u, splits) => splits.map((v) =>
          new Date(v * 1000).toLocaleTimeString('zh-CN', { hour12: false })
        ),
        grid: { stroke: palette.grid, width: 1 },
        ticks: { stroke: palette.tick, width: 1, size: 4 },
        size: 34,
      },
      {
        scale: 'y',
        stroke: palette.axis,
        font: `11px ${font.family}`,
        grid: { stroke: palette.grid, width: 1 },
        ticks: { stroke: palette.tick, width: 1, size: 4 },
        size: 52,
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
      map.set(row.timestamp, row.value);
      timeSet.add(row.timestamp);
    }
    byVariable.set(vid, map);
  }

  const timestamps = Array.from(timeSet).sort((a, b) => a - b);
  const columns = [timestamps.map((t) => t / 1000)];

  for (const vid of variableIds) {
    const map = byVariable.get(vid);
    columns.push(timestamps.map((t) => {
      const value = map.get(t);
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }));
  }

  return columns;
}
