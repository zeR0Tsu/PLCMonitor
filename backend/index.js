const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const path = require('path');

const config = require('./config');
const Poller = require('./poller');

// ============================================================
// 初始化
// ============================================================

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const poller = new Poller();

// ============================================================
// 中间件
// ============================================================

app.use(express.json());

// 静态文件服务（前端构建产物）
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// ============================================================
// REST API
// ============================================================

// 配置
app.get('/api/config', (req, res) => {
  res.json(config.loadConfig());
});

app.put('/api/config', (req, res) => {
  const ok = config.saveConfig(req.body);
  if (ok) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '保存配置失败' });
  }
});

// PLC 管理
app.get('/api/plcs', (req, res) => {
  res.json(config.getPlcs());
});

app.post('/api/plcs', (req, res) => {
  const plc = config.addPlc(req.body);
  res.status(201).json(plc);
});

app.put('/api/plcs/:id', (req, res) => {
  const plc = config.updatePlc(req.params.id, req.body);
  if (plc) {
    res.json(plc);
  } else {
    res.status(404).json({ error: 'PLC 不存在' });
  }
});

app.delete('/api/plcs/:id', (req, res) => {
  config.deletePlc(req.params.id);
  res.json({ success: true });
});

// 变量管理
app.get('/api/variables', (req, res) => {
  res.json(config.getVariables());
});

app.post('/api/variables', (req, res) => {
  const variable = config.addVariable(req.body);
  res.status(201).json(variable);
});

app.put('/api/variables/:id', (req, res) => {
  const variable = config.updateVariable(req.params.id, req.body);
  if (variable) {
    res.json(variable);
  } else {
    res.status(404).json({ error: '变量不存在' });
  }
});

app.delete('/api/variables/:id', (req, res) => {
  config.deleteVariable(req.params.id);
  res.json({ success: true });
});

// 图表布局管理
app.get('/api/charts', (req, res) => {
  res.json(config.getCharts());
});

app.post('/api/charts', (req, res) => {
  const chart = config.addChart(req.body);
  res.status(201).json(chart);
});

app.put('/api/charts/:id', (req, res) => {
  const chart = config.updateChart(req.params.id, req.body);
  if (chart) {
    res.json(chart);
  } else {
    res.status(404).json({ error: '图表不存在' });
  }
});

app.delete('/api/charts/:id', (req, res) => {
  config.deleteChart(req.params.id);
  res.json({ success: true });
});

// ============================================================
// Socket.IO 事件处理
// ============================================================

io.on('connection', (socket) => {
  console.log(`[Socket] 客户端已连接: ${socket.id}`);

  // 加入仪表板
  socket.on('join-dashboard', () => {
    socket.join('dashboard');
    // 发送当前连接状态
    socket.emit('connection-status', poller.notifier.getAllStatuses());
  });

  // 离开仪表板
  socket.on('leave-dashboard', () => {
    socket.leave('dashboard');
  });

  // 手动连接 PLC
  socket.on('connect-plc', async (data) => {
    const { plcId } = data || {};
    if (!plcId) return;
    console.log(`[Socket] 手动连接 PLC: ${plcId}`);
    const result = await poller.connectPlc(plcId);
    // 广播最新的连接状态给所有客户端
    io.to('dashboard').emit('connection-status', poller.notifier.getAllStatuses());
    // 回复操作结果
    socket.emit('connect-plc-result', { plcId, ...result });
  });

  // 手动断开 PLC
  socket.on('disconnect-plc', (data) => {
    const { plcId } = data || {};
    if (!plcId) return;
    console.log(`[Socket] 手动断开 PLC: ${plcId}`);
    poller.disconnectPlc(plcId);
    io.to('dashboard').emit('connection-status', poller.notifier.getAllStatuses());
    socket.emit('disconnect-plc-result', { plcId, success: true });
  });

  // 请求历史数据
  socket.on('request-history', async (data) => {
    const { variableId, startTime, endTime } = data || {};
    if (!variableId) return;

    const ringData = poller.ringBuffer.getSince(variableId, startTime || 0);
    const storageData = poller.storage.query(
      variableId,
      startTime || 0,
      endTime || Date.now()
    );

    const ringTimestamps = new Set(ringData.map((d) => d.timestamp));
    const merged = [
      ...ringData,
      ...storageData.filter((d) => !ringTimestamps.has(d.timestamp)),
    ];

    socket.emit('history-data', { variableId, data: merged });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] 客户端已断开: ${socket.id}`);
  });
});

// ============================================================
// 数据分发到 Socket.IO 客户端
// ============================================================

poller.onData((data) => {
  io.to('dashboard').emit('data-update', data);
});

// 连接状态变化通知
poller.notifier.on('disconnected', (plcId, error) => {
  io.to('dashboard').emit('connection-status', poller.notifier.getAllStatuses());
});
poller.notifier.on('connected', (plcId) => {
  io.to('dashboard').emit('connection-status', poller.notifier.getAllStatuses());
});

// ============================================================
// 启动服务
// ============================================================

async function start() {
  const cfg = config.loadConfig();
  const port = process.env.PORT || cfg.server?.port || 3000;
  const bind = cfg.server?.lanBind || '0.0.0.0';

  // 初始化轮询引擎（不自动连接）
  poller.initialize(cfg);
  console.log(`[Server] 已就绪，等待手动连接 PLC...`);

  server.listen(port, bind, () => {
    console.log(`[Server] PLCMonitor 后端服务已启动: http://${bind}:${port}`);
  });
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[Server] 正在关闭...');
  poller.shutdown();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  poller.shutdown();
  server.close(() => {
    process.exit(0);
  });
});

start();
