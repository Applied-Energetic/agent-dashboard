# Agent Dashboard 扁平玻璃改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent Dashboard 更新为中文优先、克制的扁平透明玻璃界面，并发布为 0.1.3。

**Architecture:** 保留 ItemView、数据服务和交互控制器结构，只修改用户界面文案与作用域内 CSS。透明玻璃效果完全依赖 Obsidian 主题变量、伪元素和 `backdrop-filter`，不新增运行时依赖；不改变 Vault 数据流。

**Tech Stack:** TypeScript、Obsidian 官方 API、原生 DOM、CSS、Node test runner、ESBuild、ESLint。

## Global Constraints

- 插件 ID 保持 `agent-dashboard`，显示名称保持 `Agent Dashboard`。
- 版本升级为 `0.1.3`，发布日期为 `2026-07-30`，最低 Obsidian 版本保持 `1.8.0`。
- 可理解的用户界面文案尽量使用简体中文；GitHub、RSS、Codex、Claude、Agent Dashboard、路径和技术缩写保留原文。
- 不新增依赖，不改变命令、ribbon、ItemView 注册、Vault 数据扫描或网络确认流程。
- CSS 必须限定在 `.agent-dashboard-view`，优先使用 Obsidian CSS 变量，不使用 `!important` 或 `:has()`。
- 不执行 Git commit 或 push。

---

### Task 1: 中文化 Dashboard 主界面

**Files:**
- Modify: `src/views/AgentDashboardView.ts`
- Test: `tests/dashboard-ui-copy.test.mjs`

**Interfaces:**
- Consumes: 现有 `AgentDashboardController`、`DashboardDataState`、`PeriodLinkTarget`。
- Produces: 不变的 ItemView DOM 结构与 CSS 类名，仅更新用户可见字符串和 ARIA 文案。

- [ ] **Step 1: 新增界面文案源文件测试**

创建 `tests/dashboard-ui-copy.test.mjs`，读取 `src/views/AgentDashboardView.ts`，断言包含“智能体知识库”“刷新”“周期复盘”“今日任务”“本地同步”，且不再包含 `"Weekly review"`、`"Vault note creation"`、`"Today tasks"`、`"Review cadence"`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/dashboard-ui-copy.test.mjs`

Expected: FAIL，因为当前 Dashboard 仍使用英文标题。

- [ ] **Step 3: 修改 Dashboard 文案**

在 `AgentDashboardView.ts` 中完成以下映射：

- `Agentic vault` → `智能体知识库`
- `Sean's agent dashboard` → `SEAN 的智能体仪表盘`
- `Updated` → `更新于`
- `Refresh` → `刷新`
- 六个快捷操作分别改为“新建日记”“深度研究”“拉取 RSS”“GitHub 动态”“收集到 Inbox”“Vault 检查”
- `Vault pulse` → `知识库状态`
- 三个指标改为“知识库健康度”“Inbox 待处理”“任务流”
- `Vault note creation` → `笔记创建热力图`
- `Review cadence` → `周期复盘`
- 四个入口改为“每周复盘”“每月复盘”“季度复盘”“年度复盘”
- `Today tasks` → `今日任务`
- `GitHub & RSS feed` → `GitHub 与 RSS 信息流`
- LIVE、同步、空状态、错误提示、ARIA 和状态标签使用对应简体中文。

保留 GitHub、RSS、Inbox、Vault、LOCAL 技术语义时，优先在主要标题中使用中文，在路径或产品名中保留原文。

- [ ] **Step 4: 运行文案测试和完整测试**

Run: `node --test tests/dashboard-ui-copy.test.mjs`

Expected: PASS。

Run: `npm test`

Expected: 所有测试通过。

---

### Task 2: 中文化设置、确认框和通知

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/modals.ts`
- Modify: `src/services/VaultActionService.ts`

**Interfaces:**
- Consumes: 现有设置字段、Modal details、Vault action preview。
- Produces: 相同的设置持久化与确认流程，仅更新展示文本。

- [ ] **Step 1: 中文化设置页**

将路径、周期复盘、外部信息、本地智能体、CLI 与刷新区的标题、说明、按钮和成功 Notice 改为简体中文。保留模板 token、GitHub、RSS、CLI、Codex、Claude 和示例 URL。

- [ ] **Step 2: 中文化确认框与通知**

将创建日记、Inbox、Vault 检查、网络刷新、本地研究和保存输出的确认标题、按钮、Notice 与错误说明改为简体中文。保留安全确认语义，不改变任何确认步骤。

- [ ] **Step 3: 中文化 Modal 与预览说明**

将“目标路径”“标题”“内容”“研究任务”等字段和校验提示改为简体中文；将 `VaultActionService` 生成的预览说明改为简体中文，不改变文件内容格式。

- [ ] **Step 4: 运行构建与 lint**

Run: `npm run build`

Expected: TypeScript 与生产构建通过。

Run: `npm run lint`

Expected: 0 errors，0 warnings。

---

### Task 3: 实现扁平透明玻璃视觉系统

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: 现有 `.agent-dashboard-view` 下的 DOM 类名和 Obsidian 主题变量。
- Produces: 浅色主题优先、深色主题可读、无依赖的透明玻璃样式。

- [ ] **Step 1: 重构局部视觉令牌**

在 `.agent-dashboard-view` 中定义玻璃面板、玻璃描边、玻璃 hover、弱高光和环境色令牌，值由 `color-mix()` 与 Obsidian 的 `--background-primary`、`--background-secondary`、`--interactive-accent`、`--background-modifier-border` 派生。

- [ ] **Step 2: 增加环境背景**

让 `.agent-dashboard` 使用透明底色，并通过作用域内伪元素增加两个低对比、不可交互的径向色晕；内容保持在色晕之上，主背景仍继承 Obsidian。

- [ ] **Step 3: 扁平化卡片和按钮**

统一快捷操作、指标、热力图、周期复盘、列表、路径提示和运行状态面板：

- 半透明背景；
- `backdrop-filter: blur(12px) saturate(115%)`；
- 细描边与极弱内高光；
- 无投影、无位移；
- 无彩色底边和状态卡片彩色左边；
- hover 仅改变背景与描边。

- [ ] **Step 4: 优化层级和细节**

将主要卡片标题、指标数字和数据标签的对比拉开；统一列表行透明 hover；让热力图零值、活跃值和图例在透明背景上仍清晰；确保按钮和周期行最小高度至少 44px。

- [ ] **Step 5: 完成响应式与降级**

保留 1100px 下热力图与周期卡片上下排列、800px 下单列布局；在不支持 `backdrop-filter` 时依赖半透明背景保持可读；保留 `focus-visible` 与 reduced-motion。

- [ ] **Step 6: 运行样式静态检查**

Run: `rg -n "!important|:has\\(|translateY|border-bottom-color" styles.css`

Expected: 无结果。

Run: `npm run lint`

Expected: 0 errors，0 warnings。

---

### Task 4: 发布 0.1.3 并部署

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `versions.json`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: 已通过验证的主界面与样式。
- Produces: 版本一致的 0.1.3 插件产物。

- [ ] **Step 1: 更新发布元数据**

将 manifest、package、lockfile、AGENTS 和 CLAUDE 的版本更新为 `0.1.3`；在 `versions.json` 增加 `"0.1.3": "1.8.0"`；在 CHANGELOG 顶部增加 `0.1.3 — 2026-07-30`，记录扁平玻璃样式与中文界面。

- [ ] **Step 2: 运行最终验证**

Run: `npm test`

Expected: 所有测试通过。

Run: `npm run build`

Expected: TypeScript 与生产构建通过。

Run: `npm run lint`

Expected: 0 errors，0 warnings。

Run: `git diff --check`

Expected: 无空白错误。

- [ ] **Step 3: 检查版本与文档一致性**

使用 Node 解析 manifest、package、lockfile 和 versions，确认版本均为 0.1.3；使用 SHA-256 确认 `AGENTS.md` 与 `CLAUDE.md` 内容一致。

- [ ] **Step 4: 自动部署**

从 `%APPDATA%\obsidian\obsidian.json` 定位当前打开的 `Blog_backup`，验证目标路径位于 Vault 内，仅复制 `main.js`、`manifest.json`、`styles.css` 到 `.obsidian/plugins/agent-dashboard`。

- [ ] **Step 5: 校验部署产物**

对三个源文件和目标文件计算 SHA-256，全部一致才报告部署成功。不得执行 commit 或 push。
