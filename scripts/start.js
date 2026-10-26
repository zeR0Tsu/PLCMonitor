/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const distIndex = path.join(root, 'frontend', 'dist', 'index.html');
const isWindows = process.platform === 'win32';

function log(message) {
  console.log(`[启动] ${message}`);
}

function fail(message) {
  console.error(`[启动失败] ${message}`);
  process.exit(1);
}

function readPort() {
  if (process.env.PORT) return Number(process.env.PORT);
  try {
    const raw = fs.readFileSync(path.join(root, 'config.json'), 'utf-8').replace(/^\uFEFF/, '');
    return Number(JSON.parse(raw).server?.port) || 3000;
  } catch (_) {
    return 3000;
  }
}

function ensureNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    fail(`当前 Node.js 版本为 ${process.versions.node}，需要 20 或更高版本`);
  }
}

function ensureDependencies() {
  const marker = path.join(root, 'node_modules', 'express');
  if (fs.existsSync(marker)) return;
  log('未检测到依赖，正在执行 npm install（首次启动会稍慢）...');
  const result = spawnSync('npm', ['install'], { cwd: root, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) fail('依赖安装失败，请确认网络与 Node.js 环境');
}

function ensureConfig() {
  const target = path.join(root, 'config.json');
  if (fs.existsSync(target)) return;
  const sample = path.join(root, 'config.sample.json');
  if (!fs.existsSync(sample)) return;
  fs.copyFileSync(sample, target);
  log('已根据 config.sample.json 创建 config.json，请按需填写 PLC 信息');
}

function newestMtime(dir) {
  let newest = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        newest = Math.max(newest, fs.statSync(full).mtimeMs);
      }
    }
  };
  walk(dir);
  return newest;
}

function needsBuild() {
  if (process.env.SKIP_BUILD === '1') return false;
  if (!fs.existsSync(distIndex)) return true;
  const builtAt = fs.statSync(distIndex).mtimeMs;
  const sourceAt = Math.max(
    newestMtime(path.join(root, 'frontend', 'src')),
    fs.statSync(path.join(root, 'frontend', 'index.html')).mtimeMs,
    fs.statSync(path.join(root, 'vite.config.js')).mtimeMs
  );
  return sourceAt > builtAt;
}

function buildFrontend() {
  if (!needsBuild()) {
    log('前端构建已是最新');
    return;
  }
  log('正在构建前端...');
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) fail('前端构建失败，请查看上方日志');
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1200 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForReady(port, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await checkHealth(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function openBrowser(url) {
  if (process.env.OPEN_BROWSER === '0') {
    log(`已跳过自动打开浏览器，请手动访问 ${url}`);
    return;
  }
  log(`打开浏览器: ${url}`);
  try {
    if (isWindows) {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    log(`无法自动打开浏览器，请手动访问 ${url}`);
  }
}

async function main() {
  ensureNodeVersion();
  ensureDependencies();
  ensureConfig();

  const port = readPort();
  const url = `http://localhost:${port}`;

  if (await checkHealth(port)) {
    log(`服务已在运行（端口 ${port}）`);
    openBrowser(url);
    return;
  }

  buildFrontend();

  log(`启动后端服务（端口 ${port}）...`);
  const backend = spawn(process.execPath, [path.join(root, 'backend', 'index.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    log(`收到 ${signal}，正在停止服务...`);
    try { backend.kill(); } catch (_) { /* ignore */ }
    setTimeout(() => process.exit(0), 800);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  backend.on('exit', (code) => {
    if (!stopping) {
      console.error(`[启动失败] 后端已退出（code=${code}），常见原因：端口 ${port} 被占用`);
      process.exit(code || 1);
    }
  });

  const ready = await waitForReady(port);
  if (ready) {
    log(`服务已就绪: ${url}`);
    openBrowser(url);
    log('关闭此窗口或按 Ctrl+C 可停止服务');
  } else {
    console.error(`[启动失败] 服务在 30 秒内未就绪，请查看上方日志（端口 ${port}）`);
  }
}

main().catch((err) => fail(err.message));
