const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

const APP_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEoSURBVDiNpZMxTsNAEEX/rNeOAwUlHVdA4gJcAokLUNDRcAQkLkCBaOgouQIVHZyAgoKSK0QiJI5jr3cohuxarJOU/NJo5s+b2dEuqcpJUZQ3AJ4BzGMMl0mS3ANARK4BzM/3+yGAYbfb/QCwVEQmAHoA7kXkBcANGNmqBwBU5ATALYArETkDuAPwKiJ3AN6azWYzxjghopMkJhH5UNUpgHdVPQJ40tSqYowDETkAeAKwBfCpquOqqgYAHqsYEYmqPgL4UdWPiHwD+FHVT1V9U9WDiLRE5F1E3lV1KyK3ItJVVSWiK4vIDYA7AL0Y41pEegA+RKQfY1yLyC2AHoBtWZYjVd0AeAJwB+BNVUdVVQ0bwAf/qb0A+Ad3hHKwH4yR7gAAAABJRU5ErkJggg==';

const projectRoot = path.join(__dirname, '..');
const backendEntry = path.join(projectRoot, 'backend', 'index.js');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let backendPort = 3000;
let isQuitting = false;

function resolveConfigDir() {
  if (!app.isPackaged) return projectRoot;

  const userDataDir = app.getPath('userData');
  const userConfig = path.join(userDataDir, 'config.json');
  if (!fs.existsSync(userConfig)) {
    const bundledConfig = path.join(projectRoot, 'config.sample.json');
    try {
      if (fs.existsSync(bundledConfig)) {
        fs.copyFileSync(bundledConfig, userConfig);
      } else {
        fs.writeFileSync(userConfig, JSON.stringify({
          server: { port: 3000, lanBind: '0.0.0.0', pollIntervalMs: 100 }, plcs: [], variables: [], charts: [],
        }, null, 2));
      }
    } catch (err) {
      console.error('[Electron] 初始化配置失败:', err.message);
    }
  }
  return userDataDir;
}

function readPort(configDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8'));
    return Number(raw.server?.port) || 3000;
  } catch (_) {
    return 3000;
  }
}

function waitForBackend(port, timeoutMs = 20000) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

function startBackend(configDir) {
  return new Promise((resolve) => {
    const env = { ...process.env, PORT: String(backendPort), ELECTRON_RUN_AS_NODE: '1' };
    if (app.isPackaged) env.APP_DATA_DIR = configDir;

    try {
      backendProcess = fork(backendEntry, [], {
        cwd: projectRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
    } catch (err) {
      console.error('[Electron] 后端进程启动失败:', err);
      resolve(false);
      return;
    }

    backendProcess.stdout?.on('data', (data) => console.log(`[Backend] ${data.toString().trimEnd()}`));
    backendProcess.stderr?.on('data', (data) => console.error(`[Backend] ${data.toString().trimEnd()}`));

    backendProcess.on('message', (msg) => {
      if (msg === 'ready' || msg?.type === 'ready') resolve(true);
    });
    backendProcess.on('exit', (code, signal) => {
      console.error(`[Electron] 后端进程退出: code=${code} signal=${signal}`);
      backendProcess = null;
      if (!isQuitting && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'PLCMonitor',
          message: '后端服务已停止运行',
          detail: '请查看日志了解详情，然后重新启动应用。',
        });
      }
    });
    backendProcess.on('error', (err) => {
      console.error('[Electron] 后端进程错误:', err);
    });

    // 不依赖 IPC 消息，轮询健康检查作为兜底
    waitForBackend(backendPort).then(resolve);
  });
}

function stopBackend() {
  if (!backendProcess) return;
  const proc = backendProcess;
  backendProcess = null;
  try {
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
    }, 2000).unref?.();
  } catch (_) { /* ignore */ }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'PLCMonitor',
    icon: nativeImage.createFromDataURL(APP_ICON_DATA_URL),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${backendPort}`);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', () => {
    if (!isQuitting) {
      setTimeout(() => mainWindow?.loadURL(`http://127.0.0.1:${backendPort}`), 1500);
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(APP_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip('PLCMonitor - 运行中');

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const configDir = resolveConfigDir();
    backendPort = readPort(configDir);

    console.log(`[Electron] 启动后端，端口 ${backendPort}，配置目录 ${configDir}`);
    const ready = await startBackend(configDir);
    if (!ready) {
      dialog.showErrorBox('PLCMonitor', `后端服务未能在端口 ${backendPort} 启动，请检查端口占用或日志。`);
    }

    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });
}

app.on('window-all-closed', () => {
  // 关闭窗口时保持托盘运行
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('quit', () => {
  stopBackend();
});

process.on('exit', () => stopBackend());
