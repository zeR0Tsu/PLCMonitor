# PLC Monitor - AI 交接文档

## Project Overview

PLCMonitor 是一个基于 Node.js 的西门子 S7-1200 PLC 变量实时监视系统。后端通过 S7 协议与 PLC 通信采集数据，前端以实时图表形式展示多条曲线。采用 Electron 打包为桌面 exe，支持局域网内移动设备访问。

## Goals

- 实时采集 S7-1200 PLC 的 DB 块、I/O、M 区变量数据
- 以 10Hz 频率稳定轮询，保证数据实时性
- 在前端以多曲线叠加图表、多图表同屏方式可视化展示
- 支持多台 PLC，每台独立配置，单次只监视一台（顶部切换）
- 完整的设备配置 + 每台 PLC 独立的变量定义 + 图表布局持久化存储
- 手动连接/断开 PLC，连接不上不自动重连，等待用户操作
- 连接断开时通过前端和浏览器推送通知用户
- Electron 打包为 exe，关闭窗口最小化到托盘，后台持续采集
- 局域网内 PC 和移动设备均可通过浏览器访问

## Non-Goals

- 不对数值变化做阈值告警（仅连接断连通知）
- 不从界面写入 PLC（写入作为后续并行功能，当前不实现）
- 不需要用户身份验证
- 不需要数据导出（后续功能）
- UI 设计另行单独进行，当前只关注功能实现

## Functional Requirements

### PLC 通信
- 协议：S7 协议，使用 `node-snap7` 库（无原生模块时回退到模拟模式）
- 目标型号：西门子 S7-1200
- 连接参数：IP 地址、机架号(Rack)、槽号(Slot)
- 支持多台 PLC，每台独立配置，手动连接/断开
- 不自动连接、不自动重连，通过前端按钮触发
- 读取数据类型：Real(浮点数)、Int(整数)、Bool(布尔)、Word
- 地址类型：DB 块、I 区(输入)、Q 区(输出)、M 区(中间变量)
- 每台 PLC 典型监视 4-6 个 DB 块，最多不超过 20 个

### 数据采集
- 轮询频率：10Hz (100ms 间隔)
- 批量读取策略：按 DB 块区域一次性读取连续地址段，减少 S7 通信次数
- 所有变量统一频率采集

### 数据存储
- 分层存储策略：
  - 内存环形缓冲区：保存最近 30-60 秒原始 10Hz 数据，用于前端实时图表
  - SQLite：保存降采样数据（如 1 秒聚合），最多保留 30 分钟
- 超过 30 分钟的数据自动丢弃

### 前端可视化
- 实时折线图，Canvas 渲染（使用 uPlot 图表库）
- 单图表支持多条曲线叠加（同一图表显示多个相关变量）
- 多图表同屏展示（仪表板布局）
- 可配置的图表布局：定义哪些变量在哪个图表中显示、曲线颜色
- 响应式布局：PC 多列显示，手机自动堆叠为单列
- 时间窗口可选：30 秒 / 1 分钟 / 5 分钟 / 30 分钟
- 当前值数字卡片显示

### 配置管理
- 配置存储格式：JSON 文件（exe 同目录下）
- 配置内容：
  - PLC 列表：名称、IP、Rack、Slot、描述
  - 变量定义：所属 PLC、变量名、地址类型、DB 号、偏移、数据类型、位索引(Bool)
  - 图表布局：所属 PLC、图表标题、包含的变量列表、各变量曲线颜色
- 配置页面：通过前端页面进行 CRUD 操作，变量和图表按 PLC 独立管理

### 通知
- 连接断开时前端界面提示（状态栏变色 + 告警条）
- 浏览器推送通知（Service Worker 实现）
- 连接恢复时自动清除告警状态
- Electron 托盘图标显示连接状态（绿色正常/红色断开）

### Electron 打包
- 打包为 Windows exe
- 启动时自动启动 Node.js 后端服务 + 前端页面
- 关闭窗口：最小化到系统托盘，后台继续数据采集
- 托盘菜单：显示主窗口、退出程序
- 自动开机启动：不需要

## Non-Functional Requirements

- 10Hz 采集下前端渲染保持流畅（uPlot Canvas 渲染保证 60fps）
- 后端 Node.js 单进程，异步非阻塞轮询引擎
- 前后端通过 Socket.IO 实时通信（WebSocket）
- 局域网内低延迟数据推送
- 无身份验证，局域网内任意设备直接访问
- 纯中文界面

## Architecture

```
+-----------------------------------------------------------+
|                   Electron Shell                           |
|  +-------------------+          +------------------------+  |
|  |  Frontend         | Socket  |  Backend (Node.js)      |  |
|  |  (React+Vite)     |  IO     |  Express + Socket.IO    |  |
|  |                    |<------->|                         |  |
|  |  uPlot Charts     |  HTTP   |  Polling Engine         |  |
|  |  Config Page      |  REST   |  Snap7 Client(s)        |  |
|  |  Notification     |         |  Ring Buffer            |  |
|  +--------+----------+         |  SQLite Storage         |  |
|           |                    +------------+------------+  |
|           | Browser (LAN)                  | S7 Protocol    |
+-----------+-------------------------------+----------------+
            |                               |
      +-----+------+             +----------+-----------+
      | Mobile/PC   |             |  PLC S7-1200 (x N)  |
      | Browser     |             |  DB / I / Q / M     |
      +------------+             +---------------------+
```

### 项目结构

```
plc-monitor/
├── electron/           # Electron 主进程
│   ├── main.js         # 主进程入口，BrowserWindow + Tray
│   └── preload.js      # preload 脚本
├── backend/            # Node.js 后端
│   ├── index.js        # Express + Socket.IO 服务入口
│   ├── poller.js       # 轮询引擎
│   ├── plc-client.js   # Snap7 客户端封装
│   ├── ring-buffer.js  # 内存环形缓冲区
│   ├── storage.js      # SQLite 存储层
│   ├── config.js       # 配置管理（JSON 读写）
│   └── notifier.js     # 连接状态通知管理
├── frontend/           # React 前端
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # 监视仪表板
│   │   │   └── ConfigPage.jsx     # 配置管理页面
│   │   ├── components/
│   │   │   ├── RealtimeChart.jsx  # uPlot 图表组件
│   │   │   ├── ValueCard.jsx      # 当前值卡片
│   │   │   ├── ConnectionStatus.jsx
│   │   │   └── NotificationToast.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   └── utils/
│   │       └── chartOptions.js
│   └── vite.config.js
├── config.json         # 默认配置文件（运行时生成）
├── package.json
└── electron-builder.yml
```

## Data Model

### 配置文件结构 (config.json)

```json
{
  "server": {
    "port": 3000,
    "lanBind": "0.0.0.0"
  },
  "plcs": [
    {
      "id": "plc-1",
      "name": "生产线A",
      "ip": "192.168.1.100",
      "rack": 0,
      "slot": 1,
      "description": "1号线主PLC"
    }
  ],
  "variables": [
    {
      "id": "var-1",
      "plcId": "plc-1",
      "name": "主轴转速",
      "addressType": "DB",
      "dbNumber": 1,
      "offset": 0,
      "dataType": "Real",
      "bitIndex": null,
      "unit": "rpm",
      "description": "主轴当前转速"
    }
  ],
  "charts": [
    {
      "id": "chart-1",
      "plcId": "plc-1",
      "title": "主轴状态",
      "variableIds": ["var-1", "var-2"],
      "curveColors": { "var-1": "#2196F3", "var-2": "#F44336" },
      "timeWindow": 30
    }
  ]
}
```

### SQLite 表结构

```sql
CREATE TABLE plc_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plc_id TEXT NOT NULL,
  variable_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,   -- Unix ms
  value_real REAL,
  value_int INTEGER,
  value_bool INTEGER,
  quality TEXT DEFAULT 'good'    -- good / bad
);

CREATE INDEX idx_data_time ON plc_data(plc_id, variable_id, timestamp);
```

### 内存环形缓冲区

```
RingBuffer<K, V[]>
  Key: variable_id
  Value: Array<{ timestamp, value }>
  Capacity: 600 条 (60秒 @ 10Hz) 或 1800 条 (3分钟)
```

## APIs and Interfaces

### Socket.IO 事件

```
Client -> Server:
  join-dashboard     : {}
  leave-dashboard    : {}
  connect-plc        : { plcId: string }
  disconnect-plc     : { plcId: string }
  request-history    : { variableId: string, startTime, endTime }

Server -> Client:
  data-update        : { timestamp, values: { variableId: number }[] }
  connection-status  : { plcId, connected, error?: string }
  connect-plc-result : { plcId, success, error? }
  disconnect-plc-result : { plcId, success }
  history-data       : { variableId, data: [{ timestamp, value }] }
```

### REST API

```
GET    /api/config      - 获取完整配置
PUT    /api/config      - 更新配置
GET    /api/plcs        - 获取 PLC 列表
POST   /api/plcs        - 添加 PLC
PUT    /api/plcs/:id    - 更新 PLC
DELETE /api/plcs/:id    - 删除 PLC
GET    /api/variables   - 获取变量列表
POST   /api/variables   - 添加变量
PUT    /api/variables/:id - 更新变量
DELETE /api/variables/:id - 删除变量
GET    /api/charts      - 获取图表布局
POST   /api/charts      - 添加图表
PUT    /api/charts/:id  - 更新图表
DELETE /api/charts/:id  - 删除图表
```

## Constraints and Assumptions

- S7-1200 在同一局域网内，IP 可达
- Snap7 通信基于 TCP 102 端口，需确保防火墙放行
- 每台 PLC 的 CPU 负载能承受 10Hz 的外部读取
- 前端仅支持现代浏览器（Chrome、Edge、手机浏览器）
- 配置修改后通过 config.onChange 热更新轮询引擎，无需重启采集
- 纯中文界面，无国际化需求

## Decisions Made

| 决策 | 选择 | 理由 |
|------|------|------|
| PLC 型号 | Siemens S7-1200 | 用户指定，node-snap7 支持良好 |
| 后端语言 | Node.js | 用户指定 |
| S7 库 | node-snap7 | 最成熟的 Node.js S7 通信库 |
| 实时通信 | Socket.IO | 自动重连、心跳、兼容 WebSocket |
| 前端框架 | React + Vite | 生态丰富，uPlot 集成方便 |
| 图表库 | uPlot | 10Hz 高频下 Canvas 渲染性能最优 |
| 历史存储 | SQLite | 轻量，30 分钟内数据量可控，无需独立服务 |
| 配置格式 | JSON 文件 | 透明可手动编辑，无需数据库 |
| 打包方式 | Electron | 跨平台桌面 exe |
| 关闭行为 | 最小化到托盘 | 保持后台采集不中断 |
| 身份验证 | 无 | 局域网信任环境 |
| 告警 | 仅连接断连 | 用户明确不需要数值告警 |
| 写入功能 | 暂不实现 | 复杂度更高，作为后续并行功能 |
| 连接方式 | 手动连接/断开 | 用户控制连接时机，不自动重连 |
| 仪表板模式 | 单 PLC 选择模式 | 同一时间只监视一台 PLC，顶部切换 |
| 配置管理 | 按 PLC 独立管理 | 每台 PLC 拥有独立的变量表和图表布局 |
| S7 库加载 | node-snap7 优先；无原生模块时仅允许显式开启模拟模式 | 正常使用不会自动进入模拟 |

## Implementation Plan

### Phase 1: 项目骨架与通信核心 [已完成]
1. 初始化项目结构，配置 package.json
2. 实现 PLC 客户端封装 (`plc-client.js`) -- Snap7 连接、读取
3. 实现配置管理 (`config.js`) -- JSON 文件读写
4. 轮询引擎 (`poller.js`) -- 定时轮询、批量读取、数据分发

### Phase 2: 后端服务与数据管道 [已完成]
5. Express + Socket.IO 服务 (`index.js`)
6. 内存环形缓冲区 (`ring-buffer.js`)
7. SQLite 存储层 (`storage.js`)
8. 连接状态通知管理 (`notifier.js`)

### Phase 3: 前端实时监控 [已完成]
9. React + Vite 项目搭建
10. Socket.IO 客户端连接 (`useSocket.js`)
11. uPlot 实时图表组件 (`RealtimeChart.jsx`)
12. 当前值卡片组件 (`ValueCard.jsx`)
13. 仪表板页面 (`Dashboard.jsx`)

### Phase 4: 配置页面 [已完成]
14. 配置管理页面 (`ConfigPage.jsx`)
15. PLC 管理表单
16. 变量管理表单（按 PLC 筛选）
17. 图表布局配置（按 PLC 筛选）

### Phase 5: Electron 集成 [已完成]
18. Electron 主进程 (`main.js`) -- BrowserWindow + Tray
19. preload 脚本
20. electron-builder 打包配置

### Phase 6: 通知与优化 [进行中]
21. 浏览器推送通知（Service Worker）
22. [已完成] 断连前端视觉提示
23. 托盘点连接状态指示
24. 移动端响应式适配

## Maintenance Notes（2026-10-20）

- 构建产物固定输出到 `frontend/dist`；`vite.config.js` 使用绝对路径，避免嵌套目录
- uPlot 时间轴不要设置 `ms` 选项（默认按秒处理）；自定义 `axis.values` 输出本地时间
- 轮询采用「一次完成后再排下一次」，禁止改回无保护的 setInterval 并发读取
- 配置 CRUD 保存后由 `config.onChange` 触发 `poller.syncConfig()`，新增 PLC 立即可连接
- 存储层按 better-sqlite3 → node:sqlite → sql.js 顺序降级；sql.js 只在有变更时每 5 秒落盘
- 模拟 PLC 仅通过 `PLC_SIMULATE=1` 或 `plc.simulate = true` 启用，正常环境不可开启
- 自动化验证：`npm run smoke`（使用临时数据库，不影响 `data/plc_data.db`）
- 实测（192.168.0.120 / DB6 / 4 个 Real）：单次 S7 读取往返约 160ms，因此 100ms 周期下实际采集约 6Hz；如设备响应更慢会自动降速，不会堆积请求
- 该 PLC 同时只接受一个 S7 客户端连接：TIA Portal 或其他上位机占用时会返回 10065，断开后重新连接需等待约 5-10 秒让 PLC 释放资源

## Recommended Next Steps

1. 连接真实 PLC 验证批量读取、异常重连与地址解析（等待测试环境）
2. 实施 Phase 6：浏览器推送通知、托盘点状态指示
3. 移动端响应式布局适配
4. 数据导出功能
