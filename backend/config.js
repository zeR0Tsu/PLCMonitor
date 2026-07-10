const fs = require('fs');
const path = require('path');

// 配置文件路径：exe 同目录下
let configPath = path.join(__dirname, '..', 'config.json');

// 在 Electron 环境下，config.json 与 exe 同目录
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  configPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config.json');
} else if (process.env.APP_DATA_DIR) {
  configPath = path.join(process.env.APP_DATA_DIR, 'config.json');
}

let configCache = null;

/**
 * 读取完整配置
 */
function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    configCache = JSON.parse(raw);
    return { ...configCache };
  } catch (err) {
    console.error('读取配置文件失败:', err.message);
    // 返回默认配置
    configCache = getDefaultConfig();
    return { ...configCache };
  }
}

/**
 * 保存完整配置
 */
function saveConfig(config) {
  try {
    configCache = { ...config };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('保存配置文件失败:', err.message);
    return false;
  }
}

/**
 * 获取默认配置
 */
function getDefaultConfig() {
  return {
    server: {
      port: 3000,
      lanBind: '0.0.0.0',
    },
    plcs: [],
    variables: [],
    charts: [],
  };
}

/**
 * 获取 PLC 列表
 */
function getPlcs() {
  const config = loadConfig();
  return config.plcs || [];
}

/**
 * 添加 PLC
 */
function addPlc(plc) {
  const config = loadConfig();
  const newPlc = {
    id: `plc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: plc.name || '',
    ip: plc.ip || '',
    rack: plc.rack ?? 0,
    slot: plc.slot ?? 1,
    description: plc.description || '',
  };
  config.plcs.push(newPlc);
  saveConfig(config);
  return newPlc;
}

/**
 * 更新 PLC
 */
function updatePlc(id, updates) {
  const config = loadConfig();
  const idx = config.plcs.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  config.plcs[idx] = { ...config.plcs[idx], ...updates, id };
  saveConfig(config);
  return config.plcs[idx];
}

/**
 * 删除 PLC
 */
function deletePlc(id) {
  const config = loadConfig();
  config.plcs = config.plcs.filter((p) => p.id !== id);
  // 同时删除关联的变量和图表引用
  config.variables = config.variables.filter((v) => v.plcId !== id);
  config.charts.forEach((chart) => {
    chart.variableIds = chart.variableIds.filter((vid) => {
      const varDef = config.variables.find((v) => v.id === vid);
      return varDef && varDef.plcId !== id;
    });
  });
  saveConfig(config);
  return true;
}

/**
 * 获取变量列表
 */
function getVariables() {
  const config = loadConfig();
  return config.variables || [];
}

/**
 * 添加变量
 */
function addVariable(variable) {
  const config = loadConfig();
  const newVar = {
    id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    plcId: variable.plcId || '',
    name: variable.name || '',
    addressType: variable.addressType || 'DB',
    dbNumber: variable.dbNumber ?? 1,
    offset: variable.offset ?? 0,
    dataType: variable.dataType || 'Real',
    bitIndex: variable.bitIndex ?? null,
    unit: variable.unit || '',
    description: variable.description || '',
  };
  config.variables.push(newVar);
  saveConfig(config);
  return newVar;
}

/**
 * 更新变量
 */
function updateVariable(id, updates) {
  const config = loadConfig();
  const idx = config.variables.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  config.variables[idx] = { ...config.variables[idx], ...updates, id };
  saveConfig(config);
  return config.variables[idx];
}

/**
 * 删除变量
 */
function deleteVariable(id) {
  const config = loadConfig();
  config.variables = config.variables.filter((v) => v.id !== id);
  // 同时删除图表中的引用
  config.charts.forEach((chart) => {
    chart.variableIds = chart.variableIds.filter((vid) => vid !== id);
    if (chart.curveColors) {
      delete chart.curveColors[id];
    }
  });
  saveConfig(config);
  return true;
}

/**
 * 获取图表布局列表
 */
function getCharts() {
  const config = loadConfig();
  return config.charts || [];
}

/**
 * 添加图表
 */
function addChart(chart) {
  const config = loadConfig();
  const newChart = {
    id: `chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: chart.title || '',
    variableIds: chart.variableIds || [],
    curveColors: chart.curveColors || {},
    timeWindow: chart.timeWindow ?? 30,
  };
  config.charts.push(newChart);
  saveConfig(config);
  return newChart;
}

/**
 * 更新图表
 */
function updateChart(id, updates) {
  const config = loadConfig();
  const idx = config.charts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  config.charts[idx] = { ...config.charts[idx], ...updates, id };
  saveConfig(config);
  return config.charts[idx];
}

/**
 * 删除图表
 */
function deleteChart(id) {
  const config = loadConfig();
  config.charts = config.charts.filter((c) => c.id !== id);
  saveConfig(config);
  return true;
}

module.exports = {
  loadConfig,
  saveConfig,
  getDefaultConfig,
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
};
