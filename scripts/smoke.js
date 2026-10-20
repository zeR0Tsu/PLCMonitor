/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { io } = require('socket.io-client');

const PORT = Number(process.env.SMOKE_PORT) || 3988;
const BASE = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(os.tmpdir(), `plcmonitor-smoke-${Date.now()}.db`);
const projectRoot = path.join(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ok - ${message}`);
}

function waitFor(check, { timeout = 8000, interval = 100, label = 'condition' } = {}) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const value = await check();
        if (value) {
          resolve(value);
          return;
        }
      } catch (_) { /* keep polling */ }
      if (Date.now() - startedAt > timeout) {
        reject(new Error(`等待超时: ${label}`));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

function spawnBackend() {
  const child = spawn(process.execPath, [path.join(projectRoot, 'backend', 'index.js')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      PLC_SIMULATE: '1',
      PLC_DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => process.stdout.write(`[backend] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[backend] ${data}`));
  return child;
}

async function main() {
  let backend;
  let socket;
  try {
    console.log(`启动后端 (模拟模式, 端口 ${PORT})`);
    backend = spawnBackend();

    await waitFor(async () => {
      const res = await fetch(`${BASE}/api/health`);
      return res.ok;
    }, { label: 'backend /api/health', timeout: 15000 });
    assert(true, '后端健康检查通过');

    const config = await (await fetch(`${BASE}/api/config`)).json();
    assert(Array.isArray(config.plcs) && config.plcs.length > 0, '配置中存在 PLC');
    assert(Array.isArray(config.variables) && config.variables.length > 0, '配置中存在变量');
    const plcId = config.plcs[0].id;

    socket = io(BASE, { transports: ['websocket'], reconnection: false });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    assert(socket.connected, 'Socket.IO 已连接');
    await new Promise((resolve) => socket.emit('join-dashboard', resolve));

    const dataPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('未收到 data-update')), 8000);
      socket.once('data-update', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    const connectResult = await new Promise((resolve) => {
      socket.emit('connect-plc', { plcId }, resolve);
    });
    assert(connectResult?.success === true, '模拟 PLC 连接成功');
    assert(connectResult?.simulated === true, '明确返回模拟模式标记');

    const update = await dataPromise;
    assert(Array.isArray(update.values) && update.values.length > 0, '收到实时数据');
    assert(update.values.every((v) => typeof v.value === 'number'), '采集值为数字');

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const history = await new Promise((resolve) => {
      socket.emit('request-history', { variableId: update.values[0].variableId }, resolve);
    });
    assert(Array.isArray(history?.data) && history.data.length > 0, '可查询历史数据');

    const status = await (await fetch(`${BASE}/api/status`)).json();
    assert(Object.keys(status.latestValues || {}).length > 0, '/api/status 返回最新值');
    assert(status.connectionStatuses.some((s) => s.plcId === plcId && s.connected), '连接状态为已连接');

    const disconnectResult = await new Promise((resolve) => {
      socket.emit('disconnect-plc', { plcId }, resolve);
    });
    assert(disconnectResult?.success === true, '断开 PLC 成功');

    console.log('\n冒烟测试全部通过');
  } finally {
    socket?.close();
    if (backend) {
      backend.kill();
      await new Promise((resolve) => {
        backend.once('exit', resolve);
        setTimeout(resolve, 3000);
      });
    }
    for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      try { fs.unlinkSync(file); } catch (_) { /* ignore */ }
    }
  }
}

main().catch((err) => {
  console.error(`\n冒烟测试失败: ${err.message}`);
  process.exitCode = 1;
});
