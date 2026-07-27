# Item View Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the approved static dashboard visual into a mock-only, full-size Obsidian ItemView while preserving the plugin's command and ribbon entry points.

**Architecture:** Static data lives in `src/data/mockData.ts`. `AgentDashboardView` owns ephemeral interaction state and renders scoped DOM sections with Obsidian helpers; `main.ts` registers the view and routes the existing commands/ribbon to it. `styles.css` maps the visual system to Obsidian CSS variables and never uses the prototype grid background.

**Tech Stack:** TypeScript, Obsidian public API, ItemView, CSS, no external dependencies.

## Global Constraints

- Keep plugin ID `agent-dashboard`, manifest, command registrations, and ribbon entry point.
- Do not read or modify the Vault, call any external API, add production dependencies, or run mock actions.
- Use only Obsidian public API and scoped CSS variables; fill the ItemView without the prototype's grid background.
- Run only `npm run build` for final validation, as requested.

---

### Task 1: Add mock data and ItemView sections

**Files:**
- Create: `src/data/mockData.ts`
- Create: `src/views/AgentDashboardView.ts`

**Interfaces:**
- Produces: `DASHBOARD_ACTIONS`, `DASHBOARD_METRICS`, `DASHBOARD_ACTIVITY`, `DASHBOARD_TASKS`, `DASHBOARD_GITHUB_FEED`.
- Produces: `AgentDashboardView`, `VIEW_TYPE_AGENT_DASHBOARD`.

- [ ] Define static mock types and values for the six actions, three metrics, 365 heatmap values, five tasks, and five GitHub feed items.
- [ ] Implement private render functions named `renderHeader`, `renderActions`, `renderStats`, `renderHeatmap`, `renderTasks`, and `renderGitHubFeed` using Obsidian `createEl` helpers.
- [ ] Keep interactions local: action buttons toggle a queued style, refresh changes only a mock status message, and task rows toggle in-memory completion.

### Task 2: Connect existing plugin entry points

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `AgentDashboardView`, `VIEW_TYPE_AGENT_DASHBOARD`.
- Produces: `activateDashboardView(): Promise<void>`.

- [ ] Register the ItemView with `this.registerView` during `onload`.
- [ ] Retain the ribbon registration and all existing command registrations, routing each to `activateDashboardView` instead of sample modal/editor mutation logic.
- [ ] Remove the unused sample modal, sample status bar, and global click listener.

### Task 3: Apply the scoped Obsidian theme

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: CSS classes emitted by `AgentDashboardView`.

- [ ] Scope all rules under `.agent-dashboard-view` and set it to full available width/height with `var(--background-primary)`.
- [ ] Recreate the prototype's compact editorial hierarchy using Obsidian font, text, border, status, and interactive CSS variables.
- [ ] Add visible focus styles and reduced-motion support; omit all grid-background rules.

### Task 4: Verify compilation

**Files:**
- Verify: `src/main.ts`, `src/views/AgentDashboardView.ts`, `src/data/mockData.ts`, `styles.css`

- [ ] Run `npm run build`.
- [ ] Confirm the build exits successfully and `main.js` is regenerated.
