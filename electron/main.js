const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const BACKEND_PORT = 3000;

// 后端服务的入口文件路径
const backendEntry = path.join(__dirname, '..', 'backend', 'index.js');

// 托盘图标颜色（后续可动态切换）
const TRAY_ICON_COLOR_GREEN = '#4CAF50';
const TRAY_ICON_COLOR_RED = '#F44336';

function createTrayIcon(color) {
  // 创建一个 16x16 的纯色图标作为托盘图标
  const size = 16;
  const canvas = nativeImage.createEmpty();
  // 使用原生图标，简单起见直接用 app 图标
  return nativeImage.createFromPath(path.join(__dirname, '..', 'frontend', 'public', 'icon.png'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'PLCMonitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '..', 'frontend', 'public', 'icon.png'),
  });

  // 加载后端提供的页面
  const backendUrl = `http://localhost:${BACKEND_PORT}`;
  mainWindow.loadURL(backendUrl);

  // 关闭窗口时隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // 使用一个简单的 16x16 图标
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEoSURBVDiNpZMxTsNAEEX/rNeOAwUlHVdA4gJcAokLUNDRcAQkLkCBaOgouQIVHZyAgoKSK0QiJI5jr3cohuxarJOU/NJo5s+b2dEuqcpJUZQ3AJ4BzGMMl0mS3ANARK4BzM/3+yGAYbfb/QCwVEQmAHoA7kXkBcANGNmqBwBU5ATALYArETkDuAPwKiJ3AN6azWYzxjghopMkJhH5UNUpgHdVPQJ40tSqYowDETkAeAKwBfCpquOqqgYAHqsYEYmqPgL4UdWPiHwD+FHVT1V9U9WDiLRE5F1E3lV1KyK3ItJVVSWiK4vIDYA7AL0Y41pEegA+RKQfY1yLyC2AHoBtWZYjVd0AeAJwB+BNVUdVVQ0bwAf/qb0A+Ad3hHKwH4yR7gAAAABJRU5ErkJggg=='
  );

  tray = new Tray(icon);
  tray.setToolTip('PLCMonitor - 运行中');

  const contextMenu = Menu.buildFromTemplate([
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
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    try {
      backendProcess = fork(backendEntry, [], {
        env: { ...process.env, PORT: String(BACKEND_PORT) },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data.toString().trim()}`);
      });

      backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend] ${data.toString().trim()}`);
      });

      // 等待后端启动
      backendProcess.on('message', (msg) => {
        if (msg === 'ready') {
          resolve();
        }
      });

      // 如果后端没有发送 ready 消息，等待 3 秒后也继续
      setTimeout(() => resolve(), 3000);

      backendProcess.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// ============================================================
// Electron App Lifecycle
// ============================================================

app.whenReady().then(async () => {
  try {
    // 启动后端服务
    console.log('[Electron] 启动后端服务...');
    await startBackend();
    console.log('[Electron] 后端服务已启动');

    createWindow();
    createTray();
  } catch (err) {
    console.error('[Electron] 启动失败:', err);
    // 即使后端启动失败也尝试打开窗口
    createWindow();
    createTray();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux 不退出，隐藏到托盘
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

app.on('quit', () => {
  stopBackend();
});
