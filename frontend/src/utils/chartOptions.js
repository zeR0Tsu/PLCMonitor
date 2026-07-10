/**
 * uPlot 图表选项生成工具
 */

const COMMON_COLORS = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
  '#E91E63', '#3F51B5', '#009688', '#FFC107',
];

/**
 * 生成 uPlot 图表选项
 * @param {object} chartDef - 图表定义
 * @param {Array} variables - 变量定义列表
 * @param {number} timeWindow - 时间窗口（秒）
 * @returns {object} uPlot options
 */
export function createChartOptions(chartDef, variables, timeWindow = 30) {
  const varMap = {};
  variables.forEach((v) => { varMap[v.id] = v; });

  const series = [
    // X 轴：时间
    {
      label: '时间',
      value: (u, v) => {
        const d = new Date(v * 1000);
        return d.toLocaleTimeString('zh-CN', { hour12: false });
      },
    },
  ];

  // 数据系列
  (chartDef.variableIds || []).forEach((vid, idx) => {
    const v = varMap[vid];
    const color = (chartDef.curveColors && chartDef.curveColors[vid]) || COMMON_COLORS[idx % COMMON_COLORS.length];
    series.push({
      label: v ? `${v.name}${v.unit ? ` (${v.unit})` : ''}` : vid,
      stroke: color,
      width: 2,
      points: { show: false },
      spanGaps: true,
    });
  });

  const msWindow = timeWindow * 1000;

  return {
    width: 800,
    height: 300,
    cursor: {
      show: true,
      drag: { x: true, y: true },
    },
    select: {
      show: true,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    },
    axes: [
      {
        label: '时间',
        stroke: '#999',
        grid: { stroke: 'rgba(0,0,0,0.08)', width: 1 },
        ticks: { stroke: 'rgba(0,0,0,0.1)', width: 1 },
      },
      {
        label: '数值',
        stroke: '#999',
        grid: { stroke: 'rgba(0,0,0,0.08)', width: 1 },
        ticks: { stroke: 'rgba(0,0,0,0.1)', width: 1 },
      },
    ],
  };
}

/**
 * 准备图表数据格式
 * @param {Map<string, Array>} bufferData - variableId -> [{ timestamp, value }]
 * @param {Array} variableIds - 有序的变量 ID 列表
 * @param {number} timeWindow - 时间窗口（秒）
 * @returns {[Array, Array[]]} [timestamps, values[]]
 */
export function prepareChartData(bufferData, variableIds, timeWindow = 30) {
  const now = Date.now() / 1000;
  const since = now - timeWindow;

  // 收集所有时间点
  const timeSet = new Set();
  const varData = new Map();

  variableIds.forEach((vid) => {
    const data = bufferData.get(vid) || [];
    const filtered = data.filter((d) => (d.timestamp / 1000) >= since);
    varData.set(vid, filtered);
    filtered.forEach((d) => timeSet.add(Math.floor(d.timestamp / 1000))); // 按秒对齐
  });

  const timestamps = Array.from(timeSet).sort((a, b) => a - b);

  // 构建每列的数值数组
  const columns = [timestamps];
  variableIds.forEach((vid) => {
    const data = varData.get(vid) || [];
    const dataMap = new Map();
    data.forEach((d) => dataMap.set(Math.floor(d.timestamp / 1000), d.value));

    const col = timestamps.map((t) => dataMap.has(t) ? dataMap.get(t) : null);
    columns.push(col);
  });

  return columns;
}
