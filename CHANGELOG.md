# Changelog

## 0.1.5 — 2026-07-30

- 修复按钮重置规则优先级过高导致的热力图、快捷操作和列表渲染错乱。
- 保留无阴影扁平玻璃风格，并增加样式特异性回归测试。
- 将部署后刷新插件和打开 Dashboard 验收页纳入项目流程。

## 0.1.4 — 2026-07-30

- 将笔记活跃度图升级为支持键盘操作的交互式热力图。
- 点击日期可打开已有日记；缺失日记只提示，不创建或修改文件。
- 增加中文星期标记、今日日框与日记可用状态。
- 移除全部阴影，细化扁平、透明的玻璃视觉效果。

## 0.1.3 — 2026-07-30

- Redesign the Dashboard with a flat, translucent glass visual system.
- Replace raised cards and multi-color rails with subtle borders and one accent.
- Localize primary Dashboard, settings, confirmation, and status copy into Chinese.
- Preserve the existing layout, interactions, data sources, and confirmation flows.

## 0.1.2 — 2026-07-30

- Add a dedicated Review cadence card beside the note activity heatmap.
- Resolve weekly, monthly, quarterly, and annual notes from configurable templates.
- Open current or latest available review notes without closing existing tabs.
- Stack the review card below the heatmap on narrower layouts.

## 0.1.1 — 2026-07-28

- Correct note creation dates using frontmatter, dated filenames, and file creation time.
- Align the activity heatmap to natural weeks with accurate month labels and denser cells.
- Detect missing Daily and Inbox paths and suggest matching Vault folders.
- Render task titles without raw Markdown decoration.

## 0.1.0 — 2026-07-27

- Add the initial Agent Dashboard interface and local data services.
