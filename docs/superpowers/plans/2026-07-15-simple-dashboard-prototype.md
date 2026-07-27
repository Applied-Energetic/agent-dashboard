# Simple Dashboard Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a direct-browser-previewable, vanilla HTML/CSS/JS Agentic Vault dashboard prototype under `prototype/simple-dashboard/`.

**Architecture:** `mock-data.json` is the canonical mock dataset; `script.js` exports small pure formatting/heatmap helpers for Node verification and uses a same-shape fallback only for direct `file://` preview. `index.html` provides semantic anchors and `styles.css` supplies the desktop-first Editorial Control Room visual system.

**Tech Stack:** HTML5, CSS3, vanilla ES modules, Node.js built-in test runner/assertions, no external dependencies.

---

### Task 1: Define testable presentation helpers and canonical mock data

**Files:**
- Create: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\script.test.mjs`
- Create: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\mock-data.json`

- [ ] **Step 1: Write the failing helper test**

```js
import assert from 'node:assert/strict';
import {
	FALLBACK_DATA,
	getHeatmapLevel,
	formatSyncTime,
} from './script.js';

assert.equal(FALLBACK_DATA.activity.length, 365);
assert.equal(getHeatmapLevel(0), 0);
assert.equal(getHeatmapLevel(5), 4);
assert.equal(formatSyncTime(new Date('2026-07-15T09:42:00')), 'Last sync 09:42');
console.log('simple-dashboard helpers: pass');
```

- [ ] **Step 2: Run the test and confirm expected RED state**

Run: `node prototype/simple-dashboard/script.test.mjs`

Expected: failure because `prototype/simple-dashboard/script.js` does not exist yet.

- [ ] **Step 3: Create canonical JSON mock data**

Create data for the header timestamp, six action labels, three metric cards, a 365-day activity array, five tasks, five GitHub feed items, and ten plan/review links. Keep all values fictional and local.

### Task 2: Implement render helpers and mock-only behavior

**Files:**
- Create: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\script.js`
- Modify: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\script.test.mjs`

- [ ] **Step 1: Implement the smallest exported helper surface**

```js
export function getHeatmapLevel(value) {
	return Math.max(0, Math.min(4, Math.round(value)));
}

export function formatSyncTime(date) {
	return `Last sync ${date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})}`;
}
```

- [ ] **Step 2: Add browser-only startup and render functions**

Render the metrics, weekly heatmap columns, task rows, GitHub rows, planning links, and status text. In browser mode, load JSON only over HTTP; in `file:` mode, use the matching `FALLBACK_DATA` constant. Add local-only action, refresh, task-toggle, and planning-link handlers.

- [ ] **Step 3: Run helper test and syntax check**

Run: `node prototype/simple-dashboard/script.test.mjs`

Expected: `simple-dashboard helpers: pass`.

Run: `node --check prototype/simple-dashboard/script.js`

Expected: exit code 0.

### Task 3: Build the semantic page shell

**Files:**
- Create: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\index.html`

- [ ] **Step 1: Add the static semantic anchors**

Include a `<main class="dashboard-shell">`, live region, header, action `<button>` group, three metric containers, contribution graph region, Today Tasks list, GitHub Feed list, and planning shelf. Use `<script type="module" src="script.js"></script>`.

- [ ] **Step 2: Verify the required anchors before styling**

Run: `rg -n "AGENTIC VAULT|SEAN'S AGENT DASHBOARD|Vault Note Creation|Today Tasks|GitHub Feed" prototype/simple-dashboard/index.html`

Expected: each required heading is present once.

### Task 4: Apply the Editorial Control Room visual system

**Files:**
- Create: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\styles.css`

- [ ] **Step 1: Add desktop-first tokens and layout**

Define warm-paper, graphite, mint, and chartreuse CSS variables; use a subtle grid background; build a 3-column metric row, an activity card, a two-column list row, and the planning shelf.

- [ ] **Step 2: Add interaction, focus, and reduced-motion styles**

Provide `:hover`, `:focus-visible`, `.is-queued`, `.is-done`, `.is-refreshing`, and `@media (prefers-reduced-motion: reduce)` states. Below 960px, wrap grids; below 700px, make actions horizontally scrollable.

- [ ] **Step 3: Verify static assets and final project checks**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('prototype/simple-dashboard/mock-data.json','utf8')); console.log('mock data: valid JSON')"`

Expected: `mock data: valid JSON`.

Run: `npm run build`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0, retaining only the existing sample settings warning if ESLint reports it.

### Task 5: Preview the standalone artifact

**Files:**
- Verify: `E:\Code\ObsidianDashboard\prototype\simple-dashboard\index.html`

- [ ] **Step 1: Open the file directly in a browser**

Open: `file:///E:/Code/ObsidianDashboard/prototype/simple-dashboard/index.html`

Expected: all dashboard sections render with fallback mock data and no server.

- [ ] **Step 2: Exercise mock controls**

Click one action, Refresh, one task row, and one planning link.

Expected: only local UI status/styling changes; no network, Vault, or external side effect occurs.
