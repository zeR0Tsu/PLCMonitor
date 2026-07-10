# PLCMonitor

基于 Node.js 的西门子 S7-1200 PLC 变量实时监视系统。

## 功能

- 通过 S7 协议以 10Hz 频率采集 PLC 数据（DB/I/Q/M 区）
- 支持多台 PLC，每台独立配置连接参数
- 前端 uPlot 实时曲线图表，多曲线叠加，多图表同屏
- 配置页面管理 PLC、变量、图表布局（CRUD）
- 连接状态提示，手动连接/断开
- SQLite 存储历史数据（30 分钟），内存环形缓冲区缓存实时数据
- Electron 桌面壳，托盘运行

## 快速开始

```bash
# 安装依赖
npm install

# 复制配置模板
cp config.sample.json config.json

# 开发模式（后端 + 前端）
npm run dev

# 仅后端
npm run dev:backend

# 构建前端
npm run build:frontend
```

## 配置

编辑 `config.json`，配置 PLC 连接参数、变量定义和图表布局。也可通过前端配置页面操作。

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | React + Vite + uPlot |
| 后端 | Express + Socket.IO |
| 通信 | S7 协议 (node-snap7) |
| 存储 | SQLite + 环形缓冲区 |
| 桌面 | Electron |

## 依赖说明

- `better-sqlite3`、`node-snap7` 为可选依赖，需要 C++ 编译环境或预编译二进制
- 缺少时自动回退到 `sql.js`（纯 JS SQLite）和模拟 PLC 客户端（开发测试用）
