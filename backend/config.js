const fs = require('fs');
const path = require('path');

let configPath = path.join(__dirname, '..', 'config.json');

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  configPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config.json');
} else if (process.env.APP_DATA_DIR) {
  configPath = path.join(process.env.APP_DATA_DIR, 'config.json');
}

const listeners = new Set();
let configCache = null;

function getDefaultConfig() {
  return {
    server: {
      port: 3000,
      lanBind: '0.0.0.0',
      pollIntervalMs: 100,
      simulation: false,
    },
    plcs: [],
    variables: [],
    charts: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeConfig(input) {
  const defaults = getDefaultConfig();
  const config = { ...defaults, ...(input || {}) };
  config.server = { ...defaults.server, ...(input?.server || {}) };
  config.plcs = Array.isArray(input?.plcs) ? input.plcs : [];
  config.variables = Array.isArray(input?.variables) ? input.variables : [];
  config.charts = Array.isArray(input?.charts) ? input.charts : [];
  return config;
}

function loadConfig() {
  if (configCache) return clone(configCache);
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    configCache = normalizeConfig(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[Config] 读取配置失败:', err.message);
    }
    configCache = getDefaultConfig();
  }
  return clone(configCache);
}

function saveConfig(config) {
  try {
    const normalized = normalizeConfig(config);
    const tmpPath = `${configPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), 'utf-8');
    fs.renameSync(tmpPath, configPath);
    configCache = normalized;
    notifyChange();
    return true;
  } catch (err) {
    console.error('[Config] 保存配置失败:', err.message);
    return false;
  }
}

function notifyChange() {
  const snapshot = loadConfig();
  for (const fn of listeners) {
    try { fn(snapshot); } catch (err) {
      console.error('[Config] 配置变更回调异常:', err.message);
    }
  }
}

function onChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getPlcs() {
  return loadConfig().plcs;
}

function addPlc(plc = {}) {
  const config = loadConfig();
  const newPlc = {
    id: `plc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: plc.name || '未命名 PLC',
    ip: String(plc.ip || '').trim(),
    rack: Number(plc.rack ?? 0),
    slot: Number(plc.slot ?? 1),
    description: plc.description || '',
    simulate: plc.simulate === true,
  };
  config.plcs.push(newPlc);
  saveConfig(config);
  return newPlc;
}

function updatePlc(id, updates = {}) {
  const config = loadConfig();
  const idx = config.plcs.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const normalized = { ...updates };
  if ('rack' in normalized) normalized.rack = Number(normalized.rack) || 0;
  if ('slot' in normalized) normalized.slot = Number(normalized.slot) || 0;
  if ('simulate' in normalized) normalized.simulate = normalized.simulate === true;
  config.plcs[idx] = { ...config.plcs[idx], ...normalized, id };
  saveConfig(config);
  return config.plcs[idx];
}

function deletePlc(id) {
  const config = loadConfig();
  const variableIds = new Set(
    config.variables.filter((v) => v.plcId === id).map((v) => v.id)
  );
  config.plcs = config.plcs.filter((p) => p.id !== id);
  config.variables = config.variables.filter((v) => v.plcId !== id);
  config.charts = config.charts
    .filter((c) => c.plcId !== id)
    .map((c) => ({ ...c, variableIds: (c.variableIds || []).filter((vid) => !variableIds.has(vid)) }));
  saveConfig(config);
  return true;
}

function getVariables() {
  return loadConfig().variables;
}

function addVariable(variable = {}) {
  const config = loadConfig();
  const newVar = {
    id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    plcId: variable.plcId || '',
    name: variable.name || '未命名变量',
    addressType: variable.addressType || 'DB',
    dbNumber: Number(variable.dbNumber ?? 1),
    offset: Number(variable.offset ?? 0),
    dataType: variable.dataType || 'Real',
    bitIndex: variable.bitIndex ?? null,
    unit: variable.unit || '',
    description: variable.description || '',
  };
  config.variables.push(newVar);
  saveConfig(config);
  return newVar;
}

function updateVariable(id, updates = {}) {
  const config = loadConfig();
  const idx = config.variables.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  const normalized = { ...updates };
  if ('dbNumber' in normalized) normalized.dbNumber = Number(normalized.dbNumber) || 1;
  if ('offset' in normalized) normalized.offset = Number(normalized.offset) || 0;
  if ('bitIndex' in normalized) {
    normalized.bitIndex = normalized.bitIndex === '' || normalized.bitIndex == null
      ? null
      : Number(normalized.bitIndex);
  }
  config.variables[idx] = { ...config.variables[idx], ...normalized, id };
  saveConfig(config);
  return config.variables[idx];
}

function deleteVariable(id) {
  const config = loadConfig();
  config.variables = config.variables.filter((v) => v.id !== id);
  config.charts = config.charts.map((chart) => {
    const curveColors = { ...(chart.curveColors || {}) };
    delete curveColors[id];
    return {
      ...chart,
      variableIds: (chart.variableIds || []).filter((vid) => vid !== id),
      curveColors,
    };
  });
  saveConfig(config);
  return true;
}

function getCharts() {
  return loadConfig().charts;
}

function addChart(chart = {}) {
  const config = loadConfig();
  const newChart = {
    id: `chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    plcId: chart.plcId || '',
    title: chart.title || '未命名图表',
    variableIds: chart.variableIds || [],
    curveColors: chart.curveColors || {},
    timeWindow: Number(chart.timeWindow ?? 30),
    yAxisMin: chart.yAxisMin ?? '',
    yAxisMax: chart.yAxisMax ?? '',
  };
  config.charts.push(newChart);
  saveConfig(config);
  return newChart;
}

function updateChart(id, updates = {}) {
  const config = loadConfig();
  const idx = config.charts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  config.charts[idx] = { ...config.charts[idx], ...updates, id };
  saveConfig(config);
  return config.charts[idx];
}

function deleteChart(id) {
  const config = loadConfig();
  config.charts = config.charts.filter((c) => c.id !== id);
  saveConfig(config);
  return true;
}

function getConfigPath() {
  return configPath;
}

module.exports = {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  onChange,
  getPlcs,
  addPlc,
  updatePlc,
  deletePlc,
  getVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  getCharts,
  addChart,
  updateChart,
  deleteChart,
  getConfigPath,
};
