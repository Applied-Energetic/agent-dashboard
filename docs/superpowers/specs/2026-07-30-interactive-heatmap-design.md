# Agent Dashboard 交互式日记热力图设计

## 目标

用更成熟的 GitHub contribution graph 风格实现替换当前笔记热力图，并让每个有效日期可以打开当日日记。保持原生 TypeScript、DOM 与 CSS 实现，不增加 React、D3、图表库或其他依赖。

同时进一步扁平化 Dashboard 的玻璃视觉：移除所有阴影，包括内高光和显式的 `box-shadow: none` 声明；玻璃质感只由透明背景、背景模糊、饱和度和细描边表达。

## 开源参考

- [wa0x6e/cal-heatmap](https://github.com/wa0x6e/cal-heatmap)：参考自然时间区间、月份标签、本地化、时区和 tooltip 结构。MIT License。
- [kevinsqi/react-calendar-heatmap](https://github.com/kevinsqi/react-calendar-heatmap)：参考 `onClick`、日期 title、CSS 强度分级和 GitHub 风格网格。MIT License。
- [uiwjs/react-heat-map](https://github.com/uiwjs/react-heat-map)：参考约 11px 单元格、2px 间距、起止日期、星期标签和单格渲染接口。MIT License。

本项目只借鉴交互与布局模式，不复制源码，也不安装这些库。

## 方案选择

### 采用：原生 HTML button 网格

- 每个日期使用原生 `button`，由现有 `buildHeatmapLayout` 计算 53 周 × 7 天布局。
- 延续现有 DOM helpers 和 `registerDomEvent` 生命周期管理。
- 优点是无依赖、可直接接入 Obsidian ItemView、主题变量和笔记打开逻辑。
- 不采用 SVG，避免额外的坐标、跨窗口事件和焦点管理复杂度。
- 不采用第三方组件，避免 React/D3 依赖和 Obsidian 样式隔离问题。

## 数据模型

`ActivityDay` 增加 `dailyNotePath: string | null`，继续保留 `date` 和 `count`。

日记解析顺序：

1. 在用户配置的 `dailyFolder` 内递归查找文件名为 `YYYY-MM-DD.md` 的笔记。
2. 如果配置目录不存在，使用现有路径诊断给出的首个 daily 候选目录，再递归查找。
3. 同一天出现重复日记时，按完整 Vault 相对路径排序并选择第一项，保证结果稳定。
4. 不在 daily 文件夹或候选文件夹之外猜测日记，避免打开普通日期笔记。

所有路径保持 Vault 相对路径，不保存或展示本地绝对路径。

## 打开行为

- 点击存在 `dailyNotePath` 的日期：
  - 如果日记已在 Markdown 标签页打开，直接聚焦该标签页。
  - 否则在新标签页打开。
  - Dashboard 和其他标签页保持不变。
- 点击不存在日记的日期：
  - 显示“YYYY-MM-DD 的日记不存在”。
  - 不创建文件，不修改 Vault，不打开其他笔记。
- 文件在扫描后被移动或删除：
  - 显示“日记已不存在”，并刷新 Dashboard 快照。

## 热力图结构

```text
        8月       9月       10月                    7月
   ┌──────────────────────────────────────────────────┐
一 │ □ □ ■ □ □ □ □ □ ■ □ □ □ □ □ □ □ □ □ □ □ □ □  │
三 │ □ ■ ■ □ □ ■ □ □ □ □ □ ■ □ □ □ □ □ □ □ □ □ □  │
五 │ □ □ □ □ ■ □ □ □ □ □ □ □ ■ □ □ □ □ □ □ □ □ □  │
   └──────────────────────────────────────────────────┘
```

- 保留最近 365 天，按自然周纵向排列。
- 左侧显示“一 / 三 / 五”三个弱化星期标签。
- 月份标签与周列对齐。
- 单元格约 11–13px，间距 3px，横向空间不足时允许滚动。
- 强度为 0–4 五级，颜色从透明边框底色过渡到 Obsidian 强调色。
- 当前日期使用清晰的外轮廓。
- 有日记的日期使用可辨识的边框状态；无日记仍可点击并获得提示。

## Tooltip 与键盘

- 每格 title 与 ARIA 文案显示：
  - 日期；
  - 当天创建的笔记数量；
  - “点击打开日记”或“日记不存在”。
- 使用 roving tabindex，默认只有今天位于 Tab 顺序中，避免 365 个按钮占满键盘导航。
- 方向键移动：
  - 上下移动一天；
  - 左右移动一周；
  - Home/End 移动到第一天或最后一天。
- Enter 与 Space 使用原生 button 行为。
- `focus-visible` 提供高对比外轮廓。

## 无阴影苹果玻璃

- 删除 `styles.css` 中全部 `box-shadow` 声明。
- 面板使用约 72%–86% 的主题背景混合与 `backdrop-filter: blur(16px) saturate(125%)`。
- 仅使用单像素半透明描边区分层级，不使用内高光、投影、浮动或缩放。
- 页面环境色晕进一步降低对比，确保玻璃感来自内容后的轻微色彩变化，而不是渐变装饰。
- 交互 hover 只改变背景透明度和边框颜色。
- 保留深浅主题兼容、reduced-motion 和窄屏布局。

## 测试

- 测试配置 daily 文件夹中的嵌套日记解析。
- 测试缺失配置目录时使用首个候选目录。
- 测试重复日期文件的稳定选择。
- 测试不存在日记时返回 `null`，且不触发创建流程。
- 测试 ISO 周布局、月份标签和 365 天连续性继续通过。
- 测试 TypeScript 构建、ESLint、CSS 中不存在 `box-shadow`。

## 发布

- 版本升级为 `0.1.4`，发布日期为 `2026-07-30`。
- 更新 manifest、package、lockfile、versions、CHANGELOG、AGENTS 和 CLAUDE。
- 完整运行 tests、build、lint。
- 仅部署 `main.js`、`manifest.json`、`styles.css` 到当前打开的 `Blog_backup` 并校验 SHA-256。
- 不执行 commit 或 push。
