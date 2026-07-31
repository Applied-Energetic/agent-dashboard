# Agent Dashboard

- 这是一个使用 TypeScript 编写的 Obsidian community plugin 项目，不是 Obsidian Vault。
- 插件 ID：`agent-dashboard`；显示名称：`Agent Dashboard`；版本：`0.1.5`。
- 常用命令：`npm install`、`npm run dev`、`npm run build`、`npm run lint`。
- 插件目录中最终只需要 `main.js`、`manifest.json`、`styles.css`。
- 开发时优先使用 Obsidian 官方公开 API，不依赖未公开内部 API。
- 第一版实现保持最小、可测试、可迭代；不要随意新增生产依赖。
- 涉及网络请求、遥测、云同步、删除文件或修改真实 Vault 笔记之前，必须先说明并等待确认。
- dashboard UI 相关任务优先参考 `.agents/skills/frontend-design` skill。
- Obsidian API、生命周期、manifest、安全、无障碍、插件审核规则优先参考 `.agents/skills/obsidian` skill（来源：`obsidian-plugin-skill`）。
- 不要提交 API key、token、本地 Vault 路径或私人数据。
- 不要创建 Git remote、发布仓库或执行 `git commit`，除非我明确要求。
- 大范围修改前，先说明目标、涉及文件和最小实现方案。
- 修改代码后运行 build；如有 lint，也运行 lint；最后总结修改内容和验证方式。
- 每次改版都递增版本号，并在 changelog 和 Dashboard 中更新发布日期。
- 每次验证通过后，自动从 Obsidian 配置中定位当前打开的 `Blog_backup` Vault，仅复制 `main.js`、`manifest.json`、`styles.css` 到其 `agent-dashboard` 插件目录；此部署已获持续授权，不需要再次确认，且不要把本地绝对路径写入仓库。
- 每次部署完成后，使用 Obsidian UI 刷新插件并打开 Agent Dashboard 作为验收页面；可以控制界面时截图复核视觉结果。
