const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server: SocketIOServer } = require('socket.io');

const config = require('./config');
const Poller = require('./poller');

const HISTORY_MAX_POINTS = 20000;

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const poller = new Poller();

  app.use(express.json({ limit: '2mb' }));

  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
  } else {
    console.warn(`[Server] 前端构建产物不存在: ${frontendDist}，请先运行 npm run build:frontend`);
  }

  const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  function broadcastStatuses() {
    const statuses = poller.notifier.getAllStatuses();
    io.to('dashboard').emit('connection-status', statuses);
    return statuses;
  }

  // ---------------- REST API ----------------

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      storage: poller.storage.engine,
      plcs: poller.getClients().size,
      intervalMs: poller.intervalMs,
      uptime: Math.round(process.uptime()),
    });
  });

  app.get('/api/config', (req, res) => {
    res.json(config.loadConfig());
  });

  app.put('/api/config', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: '配置格式错误' });
      return;
    }
    if (!config.saveConfig(req.body)) {
      res.status(500).json({ error: '保存配置失败' });
      return;
    }
    res.json({ success: true, config: config.loadConfig() });
  });

  app.get('/api/status', (req, res) => {
    res.json({
      server: { intervalMs: poller.intervalMs, storage: poller.storage.engine },
      connectionStatuses: poller.notifier.getAllStatuses(),
      latestValues: poller.getLatestValues(),
    });
  });

  app.get('/api/plcs', (req, res) => {
    res.json(config.getPlcs());
  });

  app.post('/api/plcs', (req, res) => {
    const body = req.body || {};
    if (!body.name || !body.ip) {
      res.status(400).json({ error: 'PLC 名称和 IP 不能为空' });
      return;
    }
    res.status(201).json(config.addPlc(body));
  });

  app.put('/api/plcs/:id', (req, res) => {
    const plc = config.updatePlc(req.params.id, req.body || {});
    if (!plc) {
      res.status(404).json({ error: 'PLC 不存在' });
      return;
    }
    res.json(plc);
  });

  app.delete('/api/plcs/:id', (req, res) => {
    poller.disconnectPlc(req.params.id);
    config.deletePlc(req.params.id);
    res.json({ success: true });
  });

  // 诊断：不经过轮询引擎，临时建立一次连接
  app.get('/api/diag/plc-connect', asyncHandler(async (req, res) => {
    const cfg = config.loadConfig();
    const plc = req.query.plcId
      ? cfg.plcs.find((p) => p.id === req.query.plcId)
      : cfg.plcs[0];
    if (!plc) {
      res.status(400).json({ error: '无 PLC 配置' });
      return;
    }
    const PlcClient = require('./plc-client');
    const client = new PlcClient({ ...plc, simulate: cfg.server?.simulation === true || plc.simulate === true });
    const startAt = Date.now();
    const ok = await client.connect();
    const elapsed = Date.now() - startAt;
    client.disconnect();
    res.json({
      success: ok,
      mode: client.simulation ? 'simulate' : 'snap7',
      error: ok ? undefined : client.lastError,
      elapsed,
    });
  }));

  app.get('/api/variables', (req, res) => {
    res.json(config.getVariables());
  });

  app.post('/api/variables', (req, res) => {
    const body = req.body || {};
    if (!body.plcId || !body.name) {
      res.status(400).json({ error: 'PLC 和变量名不能为空' });
      return;
    }
    res.status(201).json(config.addVariable(body));
  });

  app.put('/api/variables/:id', (req, res) => {
    const variable = config.updateVariable(req.params.id, req.body || {});
    if (!variable) {
      res.status(404).json({ error: '变量不存在' });
      return;
    }
    res.json(variable);
  });

  app.delete('/api/variables/:id', (req, res) => {
    config.deleteVariable(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/charts', (req, res) => {
    res.json(config.getCharts());
  });

  app.post('/api/charts', (req, res) => {
    const body = req.body || {};
    if (!body.plcId) {
      res.status(400).json({ error: '图表必须归属某个 PLC' });
      return;
    }
    res.status(201).json(config.addChart(body));
  });

  app.put('/api/charts/:id', (req, res) => {
    const chart = config.updateChart(req.params.id, req.body || {});
    if (!chart) {
      res.status(404).json({ error: '图表不存在' });
      return;
    }
    res.json(chart);
  });

  app.delete('/api/charts/:id', (req, res) => {
    config.deleteChart(req.params.id);
    res.json({ success: true });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  // 前端单页应用回退
  app.get('*', (req, res, next) => {
    const indexPath = path.join(frontendDist, 'index.html');
    if (!fs.existsSync(indexPath)) {
      next();
      return;
    }
    res.sendFile(indexPath);
  });

  app.use((err, req, res, next) => {
    console.error('[Server] 请求处理异常:', err);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: err.message || '服务器内部错误' });
  });

  // ---------------- Socket.IO ----------------

  io.on('connection', (socket) => {
    console.log(`[Socket] 客户端已连接: ${socket.id}`);

    socket.on('join-dashboard', (ack) => {
      socket.join('dashboard');
      const statuses = poller.notifier.getAllStatuses();
      socket.emit('connection-status', statuses);
      if (typeof ack === 'function') ack({ statuses });
    });

    socket.on('leave-dashboard', () => {
      socket.leave('dashboard');
    });

    socket.on('connect-plc', async (data, ack) => {
      const plcId = data?.plcId;
      if (!plcId) {
        if (typeof ack === 'function') ack({ success: false, error: '缺少 plcId' });
        return;
      }
      console.log(`[Socket] 手动连接 PLC: ${plcId}`);
      const result = await poller.connectPlc(plcId);
      const payload = { plcId, ...result };
      socket.emit('connect-plc-result', payload);
      broadcastStatuses();
      if (typeof ack === 'function') ack(payload);
    });

    socket.on('disconnect-plc', (data, ack) => {
      const plcId = data?.plcId;
      if (!plcId) {
        if (typeof ack === 'function') ack({ success: false, error: '缺少 plcId' });
        return;
      }
      console.log(`[Socket] 手动断开 PLC: ${plcId}`);
      poller.disconnectPlc(plcId);
      const payload = { plcId, success: true };
      socket.emit('disconnect-plc-result', payload);
      broadcastStatuses();
      if (typeof ack === 'function') ack(payload);
    });

    socket.on('request-history', (data, ack) => {
      const { variableId, startTime, endTime } = data || {};
      if (!variableId) {
        if (typeof ack === 'function') ack({ variableId, data: [] });
        return;
      }

      const end = Number(endTime) || Date.now();
      const start = Math.max(Number(startTime) || end - 30 * 60 * 1000, end - 30 * 60 * 1000);

      const ringData = poller.ringBuffer.getSince(variableId, start).filter((d) => d.timestamp <= end);
      const ringTimestamps = new Set(ringData.map((d) => d.timestamp));
      const storageData = poller.storage.query(variableId, start, end)
        .filter((d) => !ringTimestamps.has(d.timestamp));

      const merged = [...storageData, ...ringData]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-HISTORY_MAX_POINTS);

      socket.emit('history-data', { variableId, data: merged });
      if (typeof ack === 'function') ack({ variableId, data: merged });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] 客户端已断开: ${socket.id}`);
    });
  });

  poller.onData((data) => {
    io.to('dashboard').emit('data-update', data);
  });

  poller.notifier.on('disconnected', () => broadcastStatuses());
  poller.notifier.on('connected', () => broadcastStatuses());

  config.onChange((cfg) => {
    console.log('[Server] 检测到配置变更，同步轮询引擎');
    poller.syncConfig(cfg);
    broadcastStatuses();
  });

  return { app, server, io, poller };
}

async function start() {
  const cfg = config.loadConfig();
  const ctx = createServer();

  await ctx.poller.initialize(cfg);

  const port = Number(process.env.PORT) || Number(cfg.server?.port) || 3000;
  const bind = process.env.HOST || cfg.server?.lanBind || '0.0.0.0';

  await new Promise((resolve, reject) => {
    ctx.server.once('error', reject);
    ctx.server.listen(port, bind, resolve);
  });

  console.log(`[Server] PLCMonitor 后端已启动: http://${bind}:${port}`);
  console.log('[Server] 已就绪，等待手动连接 PLC...');

  if (process.send) process.send('ready');

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n[Server] 收到 ${signal}，正在关闭...`);
    ctx.poller.shutdown();
    await new Promise((resolve) => ctx.io.close(resolve));
    if (ctx.server.listening) ctx.server.close();
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      shutdown(signal).finally(() => process.exit(0));
    });
  }

  return ctx;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[Server] 启动失败:', err);
    process.exit(1);
  });
}

module.exports = { createServer, start };
