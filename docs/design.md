# PLCMonitor - UI Design Specification

---

## Phase 1: Understand

### User Goal

操作员需要在生产现场通过大屏、PC 或手机实时监视 PLC 设备的运行数据，快速掌握设备状态趋势。同时，工程师需要能够配置 PLC 连接、变量定义和图表布局，以适应不同设备和监视需求。

### Main Workflow

```
打开浏览器 / 启动应用
    |
    v
仪表板加载 -> 选择要监视的 PLC -> 点击连接
    |                                    |
    v                                    v
等待数据...  <-- 连接成功 --> 开始接收实时数据
    |                              |
    v                              v
多图表实时曲线展示          发现断连时推送通知
    |
    v
切换到配置页 -> 选择 PLC -> 管理变量 / 图表布局
    |
    v
保存配置 -> 回到仪表板 -> 切换 PLC -> 按新配置连接
```

### Information Hierarchy

1. **设备连接状态** -- 每台 PLC 是否在线（最优先知晓）
2. **变量实时数值** -- 当前值的数字显示
3. **变量趋势曲线** -- 最近一段时间的变化趋势
4. **图表布局** -- 多个变量分组展示的结构

### Required Interactions

- 查看实时曲线（多条曲线叠加在同一图表）
- 切换时间窗口（30s / 1min / 5min / 30min）
- 切换设备（选择查看哪台 PLC 的数据）
- 添加/编辑/删除 PLC 连接配置
- 添加/编辑/删除变量定义
- 创建/修改图表布局（将变量分配到图表、设置曲线颜色）
- 保存配置后生效

---

## Phase 2: Design Document

---

### 1. Page Overview

```
Page:
仪表板 (Dashboard)

Purpose:
实时监视 PLC 设备运行数据，多曲线趋势展示

Primary User:
生产现场操作员

Main Action:
快速查看设备运行状态和趋势
```

```
Page:
配置页 (Configuration)

Purpose:
管理 PLC 连接、变量定义和图表布局

Primary User:
工程师 / 维护人员

Main Action:
配置设备和监视方案
```

---

### 2. Layout Structure

#### 仪表板 (Dashboard)

```
Dashboard
│
├── Menu Bar
│   ├── 项目(C) | 采集(R) | 转发(T) | 工艺(A) | 视图(V) | 数据(D) | 帮助(H)
│   └── Connection Status Dot (全局状态)
│
├── Connection Alert Bar (条件显示)
│   └── [PLC名称] 连接断开 - 最后更新: HH:mm:ss
│
├── Main Body (flex 布局)
│   │
│   ├── Sidebar (240px, 左侧)
│   │   ├── Sidebar Toolbar (标题 + 筛选)
│   │   ├── Tree Node: 设备1 (可折叠)
│   │   │   ├── [x] 变量A   45.2
│   │   │   ├── [x] 变量B   320.0
│   │   │   └── [ ] 变量C   68.5
│   │   ├── Tree Node: 设备2 (可折叠)
│   │   │   ├── [x] 变量D   1024
│   │   │   └── [ ] 变量E   38.1
│   │   └── ...
│   │
│   └── Content Area (flex: 1, 右侧)
│       │
│       ├── Chart Toolbar
│       │   ├── Device Selector (当前 PLC)
│       │   ├── Time Window Selector (30s / 1m / 5m / 30m)
│       │   └── Chart Actions (暂停/继续、还原)
│       │
│       ├── Chart Canvas
│       │   └── uPlot Canvas (多曲线叠加, 占满剩余空间)
│       │
│       └── Chart Legend
│           ├── 红  变量A  45.2
│           ├── 黄  变量B  320.0
│           ├── 绿  变量C  68.5%
│           └── 蓝  变量D  1024
│
└── Status Bar (24px)
    ├── 数据文件: /data/session_001.dat
    ├── Received: 1024
    ├── 存储: D:\PLCData
    └── 转发: 0/1
```

#### 配置页 (Configuration)

```
Configuration
│
├── Top Bar
│   ├── PLCMonitor Logo / Title
│   ├── Back to Dashboard Button
│   └── Save Config Button
│
├── Config Tabs
│   ├── Tab: PLC 管理
│   │   ├── PLC List Table
│   │   │   ├── 名称 | IP | 机架 | 槽号 | 状态 | 操作
│   │   │   └── [编辑] [删除]
│   │   └── [添加 PLC] Button
│   │
│   ├── Tab: 变量管理
│   │   ├── PLC Filter Dropdown (按 PLC 筛选)
│   │   ├── Variable List Table
│   │   │   ├── 变量名 | 所属PLC | 地址(DB/偏移) | 类型 | 单位 | 操作
│   │   │   └── [编辑] [删除]
│   │   └── [添加变量] Button
│   │
│   └── Tab: 图表布局
│       ├── Chart Layout List
│       │   ├── Chart Card Preview
│       │   │   ├── 图表标题
│       │   │   ├── 包含的变量列表 (tag显示)
│       │   │   └── [编辑] [删除]
│       │   └── [添加图表] Button
│       │
│       └── Chart Editor Panel (编辑时展开)
│           ├── 图表标题 Input
│           ├── 时间窗口 Selector
│           ├── 可选变量列表 (勾选 + 颜色选择器)
│           └── [保存] [取消]
```

---

### 3. Component Table

| Component | Purpose | Position | Priority |
|---|---|---|---|
| Component | Purpose | Position | Priority |
|---|---|---|---|
| Menu Bar | 全局菜单（项目、采集、视图、帮助等） | 页面顶部 | High |
| Sidebar | 设备/变量树形列表，选择监视对象 | 左侧 240px | High |
| Chart Area | 多曲线实时趋势图主区域 | Sidebar 右侧 | High |
| Chart Toolbar | 时间窗口、设备选择、图表操作 | Chart Area 上方 | Medium |
| Chart Legend | 曲线颜色-变量名-当前值对照 | Chart Canvas 下方 | High |
| Status Bar | 采样数、存储路径、连接、转发状态 | 页面底部 24px | Medium |
| Connection Alert Bar | 显示 PLC 断连告警 | Status Bar 上方条件显示 | High |
| Config Tabs | 配置页面 Tab 导航 | Config Page 主体上方 | High |
| PLC Table/Form | 管理 PLC 连接配置 | Config Page PLC Tab | High |
| Variable Table/Form | 管理变量定义 | Config Page Variable Tab | High |
| Chart Layout List/Editor | 管理图表分组和变量分配 | Config Page Chart Tab | High |

---

### 4. Component Detail

```
Component:
Menu Bar

Purpose:
提供桌面式菜单，组织所有全局操作入口

Content:
- 项目(C): 新建、打开、保存配置等
- 采集(R): 开始/停止采集
- 转发(T): 数据转发配置
- 工艺(A): 工艺参数设置
- 视图(V): 布局切换
- 数据(D): 数据管理
- 帮助(H): 关于
- 右侧: Connection Status Dot

States:
- 正常: 显示标准菜单
- 活跃: 菜单项悬停/展开高亮

Interaction:
- 点击菜单 -> 展开下拉项
- 快捷键触发 (括号内字母)

Data Required:
- menu structure
```

```
Component:
Sidebar (Variable Tree)

Purpose:
以树形结构展示设备分组和变量列表，选择要在图表中显示的变量

Content:
- Sidebar Toolbar (标题、展开/折叠、筛选)
- Tree nodes:
  - 设备/PLC 分组 (可折叠)
  - 变量项 (可选中的叶节点)
  - 每项显示: 图标 + 变量名 + 当前值

States:
- 展开/折叠: 分组节点可展开
- 选中: 变量项高亮 (Accent 色)
- 多选: 按住 Ctrl/Shift 多选
- 空状态: "暂无变量，请先配置"

Interaction:
- 点击变量项 -> 在图表中切换显示/隐藏该曲线
- 拖动变量项 -> 调整图表中曲线的顺序
- 右键 -> 快捷操作 (编辑、删除)

Data Required:
- tree structure: { groups: [{ name, variables: [{ id, name, value }] }] }
- selectedVariableIds
```

```
Component:
Chart Area

Purpose:
变量实时趋势曲线的主显示区域

Content:
- Chart Toolbar (上方):
  - Time Window Selector (30s / 1m / 5m / 30m)
  - Device Selector (当前 PLC)
  - Chart Actions (缩放还原、暂停/继续)
- Chart Canvas (uPlot):
  - X 轴: 时间
  - Y 轴: 数值
  - 多条彩色曲线叠加
- Chart Legend (下方):
  - 每条曲线: 色块 + 变量名 + 当前值 + 单位

States:
- 正常: 曲线实时滚动
- 暂停: 曲线停止滚动，Chart Toolbar 显示 [继续]
- 连接断开: Canvas 区域显示 "连接断开" 遮罩
- 无数据: Canvas 区域显示 "等待数据..."
- 空选择: "请在左侧选择要监视的变量"

Interaction:
- 悬停 Legend -> 高亮对应曲线
- 点击 Legend -> 显示/隐藏曲线
- 鼠标拖拽/滚轮 -> 缩放/平移 (uPlot 内置)
- 点击 [暂停] -> 冻结当前视图以便分析

Data Required:
- variables[] (实时数据)
- timeWindow
- paused
```

```
Component:
Status Bar

Purpose:
显示系统运行状态信息，提供快速状态概览

Content:
- 左侧: 当前数据文件路径
- 中左: 采样计数 (Received: 1024)
- 中右: 存储路径
- 右侧: 转发状态 (0/1)

States:
- 正常: 所有状态正常
- 异常: 转发失败、存储满等红色提示

Interaction:
- 点击转发状态 -> 跳转到转发配置

Data Required:
- sampleCount
- dataFilePath
- storagePath
- forwardStatus (active/total)
- connectionStatus
```

```
Component:
Chart Card

Purpose:
在单个卡片中展示多条变量的实时趋势曲线

Content:
- 图表标题
- uPlot Canvas (时间 x 值)
- Legend (每条曲线的颜色、变量名、当前数值)
- 如果有告警: 曲线颜色变红高亮

States:
- 正常: 曲线正常绘制
- 连接断开: 图表区域显示 "连接断开" 遮罩
- 无数据: 图表显示 "等待数据..."

Interaction:
- 悬停 Legend -> 高亮对应曲线
- 点击 Legend -> 显示/隐藏对应曲线
- 触摸/鼠标拖拽 -> 图表缩放 (uPlot 内置)

Data Required:
- chart.title
- chart.variableIds[] -> variable.name, variable.color, variable.unit
- realtimeData: { timestamp, variableValues[] }
```

```
Component:
Value Card

Purpose:
以数字形式突出显示变量的当前实时值

Content:
- 变量名称 (小字, Caption)
- 当前值 (大字, 强调, Value)
- 单位 (小字, 跟在值后面)

States:
- 正常: 数值正常显示
- 断连: 显示 "--" 或 "断开"
- 数值更新: 数值变化时平滑过渡

Interaction:
- 无特殊交互, 纯展示

Data Required:
- variable.name
- variable.unit
- currentValue
```

```
Component:
Connection Alert Bar

Purpose:
当 PLC 连接断开时醒目提示用户

Content:
- 警告图标
- 文本: "[PLC名称] 连接已断开"
- 最后更新时间
- 断连持续时间
- [重连] 按钮 (手动触发重连)

States:
- 隐藏: 所有 PLC 连接正常
- 显示: 至少一台 PLC 断连
- 多台断连: 列表显示所有断连 PLC

Interaction:
- 点击 [重连] -> 触发后端尝试重新连接
- 连接恢复 -> 自动隐藏

Data Required:
- disconnectedPlcs[] (名称、IP、最后更新时间)
```

```
Component:
PLC Form (Modal/Drawer)

Purpose:
添加或编辑 PLC 连接配置

Content:
- PLC 名称 (文本输入)
- IP 地址 (文本输入, IP 格式验证)
- 机架号 Rack (数字输入, 默认 0)
- 槽号 Slot (数字输入, 默认 1)
- 描述 (文本输入, 可选)

States:
- 新建: 空表单
- 编辑: 填充现有数据
- 验证错误: 红色边框 + 错误提示

Interaction:
- [保存] -> 验证输入 -> 更新配置列表
- [取消] -> 关闭弹窗

Data Required:
- form data: { name, ip, rack, slot, description }
```

```
Component:
Variable Form (Modal/Drawer)

Purpose:
添加或编辑变量定义

Content:
- 所属 PLC (下拉选择)
- 变量名 (文本输入)
- 地址类型 (下拉: DB / I / Q / M)
- DB 块号 (数字输入, 仅 DB 类型)
- 起始偏移 (数字输入, 字节偏移)
- 位索引 (数字输入, 0-7, 仅 Bool 类型)
- 数据类型 (下拉: Real / Int / Bool / Word)
- 单位 (文本输入, 可选)
- 描述 (文本输入, 可选)

States:
- 新建: 空表单
- 编辑: 填充现有数据
- 验证错误: 红色边框 + 错误提示
- 地址类型切换 -> 显示/隐藏 DB 号、位索引字段

Interaction:
- [保存] -> 验证输入 -> 更新配置列表
- [取消] -> 关闭弹窗

Data Required:
- form data: { plcId, name, addressType, dbNumber, offset, bitIndex, dataType, unit, description }
```

```
Component:
Chart Editor Panel

Purpose:
创建或修改图表布局 -- 定义图表的标题、包含的变量及曲线颜色

Content:
- 图表标题 (文本输入)
- 时间窗口 (下拉: 30s / 1m / 5m / 30m)
- 可选变量列表 (从所有已定义变量中选择)
  - 每行: 复选框 + 变量名 + 颜色选择器 (color picker)
  - 已选变量显示在最前
- 预览区域: 简单的变量分配摘要

States:
- 新建: 空配置
- 编辑: 加载已有配置
- 未选择变量: 提示 "请至少选择一个变量"

Interaction:
- 勾选/取消变量 -> 实时更新预览
- 颜色选择器 -> 改变该变量在图表中的曲线颜色
- [保存] -> 更新图表布局
- [取消] -> 关闭编辑器

Data Required:
- variables[] (全部可用的变量列表)
- chart config: { title, variableIds[], curveColors{}, timeWindow }
```

---

### 5. Interaction Flow

#### 设备切换流程

```
用户在 Device Selector 选择另一台 PLC
    |
    v
前端发送 join-dashboard { plcId: "plc-2" }
    |
    v
后端切换数据源，开始推送 plc-2 的数据
    |
    v
所有 Chart Card 和 Value Card 更新为新 PLC 数据
    |
    v
Time Window 重置为默认值 (30s)
    |
    v
Connection Status 更新为对应 PLC 的状态
```

#### 配置保存流程

```
用户在配置页修改配置 (添加 PLC / 变量 / 图表)
    |
    v
点击 [保存配置]
    |
    v
前端发送 PUT /api/config { 完整配置对象 }
    |
    v
后端验证配置 -> 写入 config.json
    |
    v
返回成功响应
    |
    v
前端显示 Toast: "配置已保存，请返回仪表板查看"
    |
    v
用户回到仪表板 -> 后端自动按新配置重启采集
```

#### 连接断开流程

```
后端检测到 S7 连接超时或失败
    |
    v
后端发送 connection-status { plcId, connected: false, error }
    |
    v
前端收到事件
    |
    v
Connection Status Dot 变红
    |
    v
Connection Alert Bar 显示 "[PLC名称] 连接断开"
    |
    v
Chart Cards 显示 "连接断开" 遮罩
    |
    v
Value Cards 显示 "--"
    |
    v
浏览器推送通知 (如果页面不在前台)
    |
    v
用户点击 [重连] 或后端自动重连
    |
    v
成功 -> 恢复正常显示
```

#### 添加变量流程

```
用户在配置页 - 变量管理 Tab
    |
    v
点击 [添加变量] -> 打开 Modal
    |
    v
选择所属 PLC -> 输入变量名
    |
    v
选择地址类型 (DB / I / Q / M)
    |
    v
如果选择 DB -> 输入 DB 块号
    |
    v
输入起始偏移
    |
    v
选择数据类型
    |
    v
如果选择 Bool -> 输入位索引 (0-7)
    |
    v
输入单位 (可选)
    |
    v
点击 [保存]
    |
    v
前端验证: 必填字段是否完整, 偏移格式
    |
    v
无效 -> 显示字段错误提示
    |
    v
有效 -> 变量加入列表, 但未持久化
    |
    v
需要用户点击顶部 [保存配置] 才会写入文件
```

---

### 6. Design System

#### Style Direction

**Swiss Minimalism** -- 瑞士极简风格，适用于工业监控场景

Design keywords:
- 基于网格的精确布局 (12 列网格系统)
- 严格对齐，数学级别的间距
- 无衬线字体，强烈的层级对比
- 深色背景（瑞士暗色预设），适合 24/7 监控
- 克制使用色彩，黑/白/灰为基础，一个强调色
- 让数据内容本身成为视觉焦点
- 去除一切不必要的装饰线、阴影和渐变
- 信息密度高，但通过留白保持可读性

#### Layout Hierarchy & Grid System

主布局采用 **flex + fixed sidebar** 结构，配置页内部表单使用 **紧凑网格**：

```
+------------------+------------------------------------+
|  Sidebar (fixed) |  Content Area (flex: 1)             |
|  240px           |  +-------------------------------+  |
|                  |  | Chart Toolbar (36px)           |  |
|  Tree Nodes      |  +-------------------------------+  |
|  [x] 变量A       |  |                               |  |
|  [ ] 变量B       |  |  Chart Canvas (flex: 1)       |  |
|                  |  |                               |  |
|                  |  +-------------------------------+  |
|                  |  | Chart Legend (auto height)    |  |
|                  |  +-------------------------------+  |
+------------------+------------------------------------+
|  Status Bar (24px, 全宽)                                |
+--------------------------------------------------------+
```

| Region | PC (>= 1024px) | Tablet (768-1023px) | Mobile (< 768px) |
|---|---|---|---|
| Sidebar | 240px, 固定可见 | Drawer, 可切换 | 全屏 Drawer |
| Content | flex: 1 | flex: 1 (全宽) | flex: 1 (全宽) |
| Menu Bar | 28px, 完整菜单 | 28px, 合并菜单 | 28px, 关键项 |
| Status Bar | 24px, 4 段 | 24px, 2 段 | 24px, 2 段 |
| Padding | 0 (边到边) | 0 (边到边) | 0 (边到边) |

#### Color Palette

遵循瑞士暗色预设，基础色调为黑/白/灰，强调色 `#39C5BB`（青绿）。

```
Background:       #32373A   (瑞士暗色预设 - 深灰背景)
Card Surface:     #3C4145   (比背景稍亮，用于卡片)
Surface Hover:    #454A4E   (悬停状态)
Border:           #484D51   (分割线，弱化)

Text Primary:     #FFFFFF   (主文字，最高对比度)
Text Secondary:   #B8BABD   (辅助文字，次要信息)
Text Muted:       #76797D   (禁用/占位文字)

Accent:           #39C5BB   (青绿强调色 - 瑞士预设)
  Accent Hover:   #4DD4CA   (悬停态)
  Accent Muted:   #2A9E96   (非活跃状态)

Success:          #39C5BB   (复用强调色，表示正常连接)
Warning:          #E8C547   (淡黄，非饱和，用于低优先级告警)
Error:            #E06050   (柔红，用于断连和错误状态)

Data Curve Colors: (高辨识度的系列色，每条曲线清晰可辨)
  C1: #39C5BB  (青绿 - 主色)
  C2: #E8C547  (淡黄)
  C3: #E06050  (柔红)
  C4: #7DB0E0  (柔蓝)
  C5: #B8A0D8  (柔紫)
  C6: #7DC890  (柔绿)
  C7: #D8A060  (橙)
  C8: #C0B8B0  (灰)
```

#### Typography

基准字体大小: **13px**
比例尺: **1.25** (重要: 用于自然段落；次要比例尺 1.333 用于大标题)

```
Level      | Size  | Weight     | Line Height | Letter Spacing | Usage
-----------|-------|------------|-------------|----------------|-----------------------
Display    | 32px  | Bold (700) | 1.2         | -0.02em        | 页面大标题 (极少使用)
H1         | 24px  | Bold (700) | 1.25        | -0.01em        | 页面主标题
H2         | 20px  | Semibold   | 1.3         | normal         | Section 标题
           |       | (600)      |             |                |
H3         | 16px  | Semibold   | 1.35        | normal         | 卡片标题/图表标题
           |       | (600)      |             |                |
Body       | 13px  | Regular    | 1.5         | normal         | 正文/表格内容
           |       | (400)      |             |                |
Caption    | 11px  | Regular    | 1.4         | +0.02em        | 辅助文字/标签
           |       | (400)      |             |                |
Value Big  | 28px  | Bold (700) | 1.1         | -0.02em        | 数值卡片大字
Value Small| 13px  | Bold (700) | 1.2         | normal         | 图表 Legend 当前值
Button     | 13px  | Semibold   | 1.0         | +0.04em        | 按钮文字
           |       | (600)      |             |                |
Tab        | 13px  | Semibold   | 1.0         | +0.02em        | Tab 标签
           |       | (600)      |             |                |
```

Font family: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

#### Spacing System

基准单位: **4px** (瑞士风格标准)
间距值均为 4px 的倍数:

```
Token  | Value | Usage
-------|-------|---------------------------
2xs    | 4px   | 图标与文字间距、内联元素间距
xs     | 8px   | 卡片内 padding、单元格间距
sm     | 12px  | 紧凑 Section 间距
md     | 16px  | 卡片间距、列表项间距
lg     | 24px  | 页面边距、Section 间距
xl     | 32px  | 大 Section 间距
2xl    | 48px  | 页面级间距 (极少使用)
```

#### Component Sizing

```
Menu Bar:        height 28px (紧凑桌面菜单)
Sidebar:         width 240px (PC), 全屏 Drawer (mobile)
Chart Toolbar:   height 36px
Chart Canvas:    flex: 1 (占满剩余空间, min 300px)
Status Bar:      height 24px
Alert Bar:       height 36px
Config Modal:    max-width 560px (PC), fullscreen (mobile)
Sidebar Item:    height 28px (紧凑列表行)
Input Height:    32px (标准表单输入)
Button Height:   32px (标准按钮)
Button Padding:  10px 14px (水平 padding)
Table Row:       height 36px
Tab Bar:         height 36px
```

#### Icon Usage

- 使用 Material Symbols (Outlined 风格)，与 Swiss 风格的干净线条匹配
- 图标统一 18px (内联) / 20px (独立按钮)
- 仅用于功能指示，不用于装饰
- 确保图标有文字标签辅助传达含义

---

### 7. Accessibility

| 检查项 | 标准 | 状态 |
|--------|------|------|
| 色彩对比度 | 正文 >= 4.5:1 (WCAG AA), 大文字 >= 3:1 | 深色背景方案满足 AA |
| 焦点指示器 | 所有可交互元素提供清晰的 focus ring (Accent 色 2px outline + 2px offset) | 需实现 |
| 非颜色传达 | 曲线图同时使用颜色 + 线型/标签区分，不只依赖颜色 | 需实现 |
| 触控目标 | 所有可点击元素 >= 44px (移动端) | Top Bar 按钮满足 |
| 键盘导航 | Tab 顺序合理，表单可用键盘完整操作 | 需实现 |
| 屏幕阅读器 | 图表提供 aria-label 描述数据范围，动态更新区域使用 aria-live | 需实现 |

---

### 8. Swiss Quality Checklist

- [x] 布局是否有明确的网格对齐？ -- 12 列 grid 系统，严格响应式断点
- [x] 留白是否足够且一致？ -- 4px 基准倍数，全系统统一
- [x] 色彩使用是否克制且有意义？ -- 黑/白/灰基础 + 单一青绿强调色
- [x] 排版层级是否清晰可辨？ -- 1.25 比例尺，7 级层级
- [x] 组件是否足够简单？ -- 每个组件单一职责
- [x] 是否符合无障碍标准？ -- WCAG AA 目标
- [x] 是否去除了不必要的装饰？ -- 无阴影、无渐变、无冗余装饰
- [x] 强调色是否克制使用？ -- 仅用于交互元素和连接状态

---

## Responsive Behavior

### PC / 大屏 (>= 1024px)
- Sidebar: 固定 240px 宽度，始终可见
- Chart Area: 占满剩余宽度，单一大图表
- Chart Legend: 位于 Canvas 下方，横排显示
- Menu Bar: 完整显示所有菜单项
- Status Bar: 完整显示所有状态段

### 平板 (768px - 1023px)
- Sidebar: 可折叠 Drawer，默认隐藏，通过 [菜单] 按钮打开
- Chart Area: 全宽
- Chart Legend: 横排显示
- Menu Bar: 合并为 [菜单] 下拉
- Status Bar: 精简显示（采样 + 转发）

### 手机 (强制横屏)
- 页面强制锁定为横屏显示（viewport 通过 meta 标签 + CSS 锁定 landscape）
- Sidebar: Drawer 侧滑面板，从左侧滑入（横屏下仍有足够空间展示）
- Chart Area: 占满剩余宽度，横屏下接近 PC 端体验
- Chart Legend: 横排显示（横屏宽度充足）
- Menu Bar: 仅保留关键菜单项（项目、采集、视图）
- Status Bar: 精简为两段（采样 | 转发）
- Config Modal: 全屏 Drawer
- 用户竖持时提示 "请旋转设备至横屏使用"

---

## Page Mockups

### 仪表板 (Dashboard) -- PC 端

```
+----------------------------------------------------------------------------+
| 项目(C)  采集(R)  转发(T)  工艺(A)  视图(V)  数据(D)  帮助(H)       [G]   |  <- Menu Bar 28px
+----------------------------------------------------------------------------+
|  [W] 生产线A 连接已断开  最后更新: 14:23:10  [重连]                        |  <- Alert Bar (条件)
+----------------------------------------------------------------------------+
|                                                                            |
|  +------------------------+-----------------------------------------------+|
|  | 变量列表               | [ 生产线A  v] [30s|1m|5m|30m]  [II 暂停] [o 还原]|  <- Chart Toolbar 36px
|  | [+ 筛选...]            |-----------------------------------------------||
|  |                        |                                               ||
|  | 生产线A                |  Chart Area                                   ||
|  |  [x] 主轴转速  1450.5  |  .--.  .--.  .--.  .--.  .--.                ||  <- 主图表区域
|  |  [x] 进给速度  320.0   | /    \/    \/    \/    \/    \               ||     充满剩余空间
|  |  [ ] 主轴负载   68.2%  |                                               ||
|  |  [x] 温度       45.3   |                                               ||
|  |  [ ] 计数器     1024   |                                               ||
|  |                        |                                               ||
|  | 生产线B                |                                               ||
|  |  [ ] 轴电流     12.5   |                                               ||
|  |  [ ] 速度       1500   |                                               ||
|  |                        |                                               ||
|  |                        |-----------------------------------------------||
|  |                        | Legend:                                        ||
|  |                        |  [C1] 主轴转速  1450.5 rpm                     ||
|  |                        |  [C2] 进给速度  320.0  mm/min                  ||
|  |                        |  [C4] 温度       45.3   deg C                  ||
|  |                        |                                                ||
|  +------------------------+------------------------------------------------+|
|                                                                            |
|  数据文件: session_001.dat   | 采样: 1024   | 存储: D:\PLCData   | 转发: 0/1 |  <- Status Bar 24px
+----------------------------------------------------------------------------+

Legend: C1=青绿  C2=淡黄  C3=柔红  C4=柔蓝  C5=柔紫  C6=柔绿  C7=橙  C8=灰
```

### 仪表板 (Dashboard) -- 手机端 (强制横屏)

```
+-----------------------------------------------------------------+
| 项目  采集  视图  帮助                                 [G]       |  <- Menu Bar (紧凑)
+-----------------------------------------------------------------+
|  [W] 生产线A 断连  [重连]                                       |  <- Alert Bar
+-----------------------------------------------------------------+
| [=]  [ 生产线A v] [30s] [暂停]                                  |  <- [=] 打开 Sidebar
+-----------------------------------------------------------------+
| Sidebar (Drawer)                                                 |
| +-----+  Chart Area                                              |
| |变量  |  .--.  .--.  .--.  .--.  .--.                          |
| |[x]A  | /    \/    \/    \/    \/    \                         |
| |[x]B  |                                                         |  <- 横屏下接近 PC 体验
| |[ ]C  |                                                         |
| |[x]D  |                                                         |
| |      | Legend:                                                 |
| |      | [C1] A  1450  [C2] B  320  [C4] D  45.3                |  <- 横排 Legend
| +------+                                                         |
+-----------------------------------------------------------------+
| 采样: 1024   |  转发: 0/1                                        |  <- Status Bar
+-----------------------------------------------------------------+
```

### 配置页 -- PC 端

```
+----------------------------------------------------------------------+
|  PLCMonitor                    [< 返回仪表板]  [C 保存配置]          |
+----------------------------------------------------------------------+
|                                                                      |
|  [ PLC 管理 ] [ 变量管理 ] [ 图表布局 ]                               |  <- Config Tabs
|                                                                      |
|  +------------------------------------------------------------+     |
|  | 名称       | IP           | 机架 | 槽号 | 状态 | 操作       |     |
|  |------------|--------------|------|------|------|------------|     |
|  | 生产线A    | 192.168.1.100| 0    | 1    | 在线  | [编辑][删除]|     |
|  | 生产线B    | 192.168.1.101| 0    | 2    | 离线  | [编辑][删除]|     |
|  | 包装线     | 192.168.1.102| 0    | 1    | 在线  | [编辑][删除]|     |
|  |            |              |      |      |      |            |     |
|  | [ + 添加 PLC ]                                         |     |
|  +------------------------------------------------------------+     |
|                                                                      |
+----------------------------------------------------------------------+
```

### 配置页 -- 变量管理 Tab (编辑状态)

```
+----------------------------------------------------------------------+
|  PLCMonitor                    [< 返回仪表板]  [C 保存配置]          |
+----------------------------------------------------------------------+
|                                                                      |
|  [ PLC 管理 ] [ 变量管理 ] [ 图表布局 ]                               |
|                                                                      |
|  筛选PLC: [ 全部  v]                                                 |
|                                                                      |
|  +------------------------------------------------------------+     |
|  | 变量名    | 所属PLC | 地址        | 类型 | 单位     | 操作   |     |
|  |-----------|---------|-------------|------|----------|--------|     |
|  | 主轴转速  | 生产线A | DB1.DBD0   | Real | rpm     | [编辑]  |     |
|  | 进给速度  | 生产线A | DB1.DBD4   | Real | mm/min  | [编辑]  |     |
|  | 主轴负载  | 生产线A | DB1.DBD8   | Real | %       | [编辑]  |     |
|  | 急停状态  | 生产线A | DB1.DBX12.0| Bool |         | [编辑]  |     |
|  | 轴电流    | 生产线B | DB2.DBW0   | Int  | A       | [编辑]  |     |
|                                                                      |
|  | [ + 添加变量 ]                                            |     |
|  +------------------------------------------------------------+     |
|                                                                      |
|  +------------------------------------------------------------+     |
|  | 添加变量                                       [X] 关闭   |     |
|  |                                                              |     |
|  | 所属PLC:  [ 生产线A  v]                                       |     |
|  | 变量名:   [________________]                                   |     |
|  | 地址类型: [ DB  v]   DB块: [ 1  ]                             |     |
|  | 偏移:     [ 0  ]     位索引: [ -- ] (仅Bool)                  |     |
|  | 数据类型: [ Real  v]                                          |     |
|  | 单位:     [ rpm  ]                                            |     |
|  | 描述:     [ 主轴当前转速  ]                                    |     |
|  |                                                              |     |
|  |                     [ 取消 ]  [ + 保存 ]                      |     |
|  +------------------------------------------------------------+     |
|                                                                      |
+----------------------------------------------------------------------+
```

### 配置页 -- 图表布局 Tab (编辑状态)

```
+----------------------------------------------------------------------+
|  PLCMonitor                    [< 返回仪表板]  [C 保存配置]          |
+----------------------------------------------------------------------+
|                                                                      |
|  [ PLC 管理 ] [ 变量管理 ] [ 图表布局 ]                               |
|                                                                      |
|  +------------------------------------------------------------+     |
|  | 图表标题            | 包含变量              | 操作           |     |
|  |---------------------|-----------------------|----------------|     |
|  | 主轴状态            | 主轴转速, 主轴负载    | [编辑][删除]   |     |
|  | 进给系统            | 进给速度, 轴电流      | [编辑][删除]   |     |
|  | 温度曲线            | 温度A, 温度B          | [编辑][删除]   |     |
|                                                                      |
|  | [ + 添加图表 ]                                           |     |
|  +------------------------------------------------------------+     |
|                                                                      |
|  +------------------------------------------------------------+     |
|  | 编辑图表: 主轴状态                              [X] 关闭   |     |
|  |                                                              |     |
|  | 图表标题:   [ 主轴状态          ]                            |     |
|  | 时间窗口:   [ 30秒  v]                                      |     |
|  |                                                              |     |
|  | 选择变量:                                                   |     |
|  |  [x] 主轴转速  [ #39C5BB  ]  rpm      <- 青绿               |     |
|  |  [x] 主轴负载  [ #E06050  ]  %        <- 柔红               |     |
|  |  [ ] 进给速度  [ #E8C547  ]  mm/min                         |     |
|  |  [ ] 轴电流    [ #7DB0E0  ]  A                              |     |
|  |  [x] 温度A     [ #B8A0D8  ]  deg C    <- 柔紫               |     |
|  |  [ ] 温度B     [ #7DC890  ]  deg C                          |     |
|  |                                                              |     |
|  | 预览: 主轴转速(青绿) + 主轴负载(柔红) + 温度A(柔紫)          |     |
|  |                                                              |     |
|  |                     [ 取消 ]  [ + 保存 ]                     |     |
|  +------------------------------------------------------------+     |
|                                                                      |
+----------------------------------------------------------------------+
```

---

## Approval Gate

Design specification completed. Would you like to refine any section?
