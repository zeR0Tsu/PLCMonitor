# PLCMonitor

基于 Node.js 的西门子 S7-1200 PLC 变量实时监视系统：S7 协议采集、Socket.IO 推送、React + uPlot 实时曲线、SQLite 历史数据、Electron 桌面托盘运行。

## 功能

- 通过 S7 协议按配置周期采集 PLC 数据（DB / I / Q / M 区，支持 Bool、Byte、Int、Word、DWord、DInt、Real）
- 多台 PLC 独立配置，手动连接/断开，同一时间在仪表板监视一台
- 多曲线叠加、多图表同屏，时间窗口 30s / 1m / 5m / 30m
- 配置页面管理 PLC、变量、图表布局，保存后后端热更新，无需重启
- 断连提示、连接错误信息透传
- SQLite 历史数据（最近 30 分钟，自动清理）+ 内存环形缓冲区
- Electron 桌面应用：关闭窗口最小化到托盘，后台持续采集

## 环境要求

- Node.js >= 20.11（推荐 22 LTS 或更高）
- Windows（Electron 打包目标）；后端本身跨平台
- 访问 PLC 需放行 TCP 102 端口

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 准备配置（首次）
copy config.sample.json config.json   # Windows
# cp config.sample.json config.json   # macOS / Linux

# 3. 启动开发环境（后端 + 前端热更新）
npm run dev
```

- 前端开发地址：<http://localhost:5173>
- 后端接口：<http://localhost:3000>（端口取 `config.json` 的 `server.port`）
- 开发模式下 Vite 会把 `/api` 和 `/socket.io` 代理到后端

其他命令：

```bash
npm run dev:backend    # 只启动后端
npm run dev:frontend   # 只启动前端（依赖已运行的后端）
npm run build          # 构建前端到 frontend/dist
npm start              # 生产模式启动后端（服务 frontend/dist）
npm run electron:dev   # Electron 开发模式
npm run electron:build # 打包 Windows 安装包
npm run smoke          # 冒烟测试（模拟 PLC，全链路）
```

## 配置

配置保存在 `config.json`（首次可复制 `config.sample.json`），也可在前端配置页面修改。

```json
{
  "server": {
    "port": 3008,
    "lanBind": "0.0.0.0",
    "pollIntervalMs": 100,
    "simulation": false
  },
  "plcs": [
    { "id": "plc-1", "name": "生产线A", "ip": "192.168.0.10", "rack": 0, "slot": 1 }
  ],
  "variables": [
    {
      "id": "var-1", "plcId": "plc-1", "name": "重量",
      "addressType": "DB", "dbNumber": 6, "offset": 136,
      "dataType": "Real", "bitIndex": null, "unit": "kg"
    }
  ],
  "charts": [
    { "id": "chart-1", "plcId": "plc-1", "title": "实时数据", "variableIds": ["var-1"], "timeWindow": 30 }
  ]
}
```

- `server.pollIntervalMs`：采集周期，默认 100ms（10Hz）
- `server.lanBind`：`0.0.0.0` 允许局域网访问，`127.0.0.1` 仅本机
- 变量地址：`addressType=DB` 时使用 `dbNumber + offset`；Bool 需设置 `bitIndex`（0-7）
- Electron 打包版配置位于用户数据目录：`%APPDATA%/PLCMonitor/config.json`

### 调试用的模拟 PLC

模拟模式只用于在没有 PLC 时验证链路，**正常使用不会自动启用**：

```bash
# 方式一：环境变量（所有 PLC 都使用模拟数据）
set PLC_SIMULATE=1 && npm start

# 方式二：在 config.json 中给单台 PLC 加 "simulate": true
```

模拟模式会在连接结果里返回 `simulated: true`，请勿在正式环境开启。

## 项目结构

```
backend/
  index.js        Express + Socket.IO 服务、REST API
  poller.js       轮询调度、连接状态、数据分发、配置热更新
  plc-client.js   Snap7 封装、批量读取、模拟后端
  ring-buffer.js  实时内存环形缓冲（30 分钟 @ 10Hz）
  storage.js      SQLite 存储（better-sqlite3 / node:sqlite / sql.js）
  notifier.js     连接状态管理
  config.js       配置读写、变更通知
electron/
  main.js         主进程、后端进程管理、托盘
  preload.js      渲染进程安全桥
frontend/
  src/pages/Dashboard.jsx   实时监控
  src/pages/ConfigPage.jsx  配置管理
  src/components/           RealtimeChart / ConnectionStatus / NotificationToast
  src/hooks/useSocket.js    Socket.IO 封装（ack 请求）
  src/utils/chartOptions.js uPlot 选项与数据转换
scripts/
  smoke.js        全链路冒烟测试
```

## 主要接口

REST：

- `GET /api/health`：服务与存储状态
- `GET /api/status`：连接状态与最新值
- `GET/PUT /api/config`：完整配置
- `/api/plcs`、`/api/variables`、`/api/charts`：标准 CRUD
- `GET /api/diag/plc-connect?plcId=...`：临时建立一次连接做诊断

Socket.IO：

- 客户端：`join-dashboard`、`connect-plc`、`disconnect-plc`、`request-history`
- 服务端：`data-update`、`connection-status`、`history-data`
- `connect-plc` / `disconnect-plc` / `request-history` 均支持 ack 回调

## 已知限制

- 不支持写入 PLC、数值告警、数据导出
- 历史数据仅保留 30 分钟，超出后自动删除
- 无身份验证，仅适用于可信局域网
- 采集周期为「目标值」：实际频率受 PLC 响应时间限制（实测 4 个 Real 一次读取约 160ms，100ms 配置下实际约 6Hz）
- 单台 PLC 通常只允许 1 个 S7 连接：TIA Portal、其他上位机占用时会连接失败，断开后需等待数秒再重连
- `node-snap7` 为原生模块：Electron 打包前需针对 Electron ABI 重建（`electron-rebuild`），否则真实 PLC 连接不可用；未安装时只能使用显式模拟模式
- 本地未安装 `better-sqlite3` 时自动回退到 Node 内置 `node:sqlite` 或 `sql.js`
