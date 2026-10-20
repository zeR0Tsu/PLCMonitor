# PLCMonitor - 项目进度

## 总体状态

| 阶段 | 状态 |
|------|------|
| 需求调研 | 已完成 |
| 架构设计 | 已完成 |
| Phase 1: 项目骨架与通信核心 | 已完成 |
| Phase 2: 后端服务与数据管道 | 已完成 |
| Phase 3: 前端实时监控 | 已完成 |
| Phase 4: 配置页面 | 已完成 |
| Phase 5: Electron 集成 | 已完成 |
| Phase 6: 通知与优化 | 进行中 |

## 需求决策记录

| 决策项 | 结论 |
|--------|------|
| PLC 型号 | Siemens S7-1200 |
| 通信协议 | S7 (node-snap7) |
| 采集频率 | 10Hz (100ms) |
| 历史存储 | 内存环形缓冲区 + SQLite，最长 30 分钟 |
| 前端框架 | React + Vite |
| 图表库 | uPlot |
| 实时通信 | Socket.IO |
| 打包方式 | Electron exe |
| 窗口关闭行为 | 最小化到托盘 |
| 身份验证 | 无 |
| 数值告警 | 不需要 |
| 连接断连通知 | 前端提示 + 浏览器推送 |
| 写入 PLC | 当前版本不支持（后续并行功能） |
| 移动端适配 | 响应式布局 |
| 数据导出 | 暂不支持 |

## 待办清单

### Phase 1: 项目骨架与通信核心
- [x] 初始化项目结构，配置 package.json
- [x] 实现 PLC 客户端封装 (`plc-client.js`)
- [x] 实现配置管理 (`config.js`)
- [x] 轮询引擎 (`poller.js`)

### Phase 2: 后端服务与数据管道
- [x] Express + Socket.IO 服务 (`index.js`)
- [x] 内存环形缓冲区 (`ring-buffer.js`)
- [x] SQLite 存储层 (`storage.js`)
- [x] 连接状态通知管理 (`notifier.js`)

### Phase 3: 前端实时监控
- [x] React + Vite 项目搭建
- [x] Socket.IO 客户端连接 (`useSocket.js`)
- [x] uPlot 实时图表组件 (`RealtimeChart.jsx`)
- [x] 仪表板页面 (`Dashboard.jsx`)

### Phase 4: 配置页面
- [x] 配置管理页面 (`ConfigPage.jsx`)
- [x] PLC 管理表单
- [x] 变量管理表单
- [x] 图表布局配置

### Phase 5: Electron 集成
- [x] Electron 主进程 (`main.js`)
- [x] preload 脚本
- [x] electron-builder 打包配置

### Phase 6: 通知与优化
- [x] 断连前端视觉提示
- [x] 连接状态显示 PLC 名称
- [ ] 浏览器推送通知（Service Worker）
- [ ] 托盘连接状态指示
- [ ] 移动端响应式适配

## 2026-10-20 项目整理

- [x] 修复 Vite 构建输出目录（原先落到 frontend/frontend/dist，后端一直在服务旧文件）
- [x] 修复 uPlot 时间轴（误设 `ms: 1/60`，日期显示为 1973 年）
- [x] uPlot 选项/曲线变化时重建图表，切换变量立即生效
- [x] 轮询改为串行调度，避免读取慢时请求堆积
- [x] 失败计数按 PLC 隔离，连续失败后重建连接
- [x] 配置增删改后热更新轮询引擎，无需重启后端
- [x] 存储初始化等待完成；兼容 better-sqlite3 / node:sqlite / sql.js
- [x] sql.js 改为低频整库落盘，降低 IO 压力
- [x] Socket 请求改用 ack，避免多 PLC 操作结果串台
- [x] Electron 端口读取配置并等待后端健康检查
- [x] 新增显式模拟 PLC 模式与冒烟测试（npm run smoke）
- [x] 清理无效组件、占位图标与嵌套构建产物

## 2026-10-20 真实 PLC 验证

- 目标：192.168.0.120，DB6 偏移 44 / 48 / 52 / 56，4 个 Real
- 结果：连接成功，读数与 node-snap7 直读一致（1239 / -5 / 1268 / 39 附近）
- 轮询串行化后实际采样约 6Hz（单次读取往返约 160ms）
- 发现该 PLC 仅接受一个 S7 连接：其他上位机占用时返回 10065；已补充错误提示与失败后资源释放
- 自动化：`npm run smoke` 持续通过
