# PLCMonitor - 项目概述

## 项目定位

PLCMonitor 是一个基于 Node.js 的西门子 S7-1200 PLC 变量实时监视系统。通过 S7 协议采集 PLC 数据，在前端以实时图表形式可视化展示，支持局域网内多设备访问。

## 核心功能

- **实时数据采集**：通过 S7 协议以 10Hz 频率读取 PLC 的 DB 块、I/O、M 区变量
- **多 PLC 支持**：支持多台 PLC，每台独立配置，手动连接/断开，单次只监视一台
- **实时图表显示**：多曲线叠加、多图表同屏的实时趋势图（uPlot Canvas 渲染）
- **配置持久化**：PLC 连接、变量定义、图表布局完整保存，按 PLC 独立管理
- **连接状态通知**：断连时前端提示；浏览器推送通知待实现
- **调试模拟**：仅在显式开启 `PLC_SIMULATE=1` 或 `plc.simulate` 时启用，正常环境不生效
- **手动连接**：不自动连接/重连，通过前端按钮手动触发
- **Electron 桌面应用**：打包为 exe，托盘运行，后台持续采集

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React + Vite |
| 图表库 | uPlot (Canvas 渲染，高性能) |
| 实时通信 | Socket.IO |
| S7 协议 | node-snap7 |
| 数据存储 | SQLite + 内存环形缓冲区 |
| 配置格式 | JSON 文件 |
| 桌面壳 | Electron |

## 部署方式

- Electron 打包为 Windows exe
- 关闭窗口最小化到系统托盘，后台继续采集
- 局域网绑定 `0.0.0.0`，PC 和手机均可通过浏览器访问
- 无身份验证，局域网信任环境

## 项目结构

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
│   │   │   ├── ConnectionStatus.jsx
│   │   │   └── NotificationToast.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   └── utils/
│   │       └── chartOptions.js
│   └── vite.config.js
├── scripts/
│   └── smoke.js        # 全链路冒烟测试
├── config.json         # 本地配置（运行时生成）
├── config.sample.json
├── package.json
└── electron-builder 配置（package.json 内 build 字段）
```
