# Simple Dashboard Prototype Design

## Goal

Create a browser-openable, static desktop-light prototype for an Obsidian Agentic Vault dashboard. The prototype demonstrates hierarchy, density, mock interactions, and planning-link affordances only; it does not call Obsidian APIs, GitHub, RSS, or the network.

## Chosen visual direction

Use **Editorial Control Room**: a warm off-white canvas with a subtle square grid, fine graphite borders, near-black ink, mono-style utility labels, and one chartreuse highlight. Cards stay square-to-soft rather than floating SaaS panels. The result should feel like a personal knowledge-work instrument inside Obsidian.

## Files and responsibilities

- `prototype/simple-dashboard/index.html` — semantic page structure, inline SVG icons, accessible button labels, and placeholders for rendered metrics, activity cells, lists, and planning links.
- `prototype/simple-dashboard/styles.css` — responsive desktop-first layout, design tokens, grid texture, card styling, contribution graph colors, hover/focus states, and small CSS-only motion.
- `prototype/simple-dashboard/mock-data.json` — canonical mock vault metrics, 365 daily activity values, task rows, GitHub feed rows, action labels, and planning/review links.
- `prototype/simple-dashboard/script.js` — renders cards, heatmap, lists, planning links, and visual-only button states from local mock data.

## Page composition

1. **Header:** `AGENTIC VAULT`, `SEAN'S AGENT DASHBOARD`, LIVE indicator, last-sync text, and a Refresh control.
2. **Action rail:** six equal-priority mock controls: New Diary, Deep Research, Pull RSS Feeds, GitHub Feeds, Inbox Ingest, Vault Lint.
3. **Metric row:** Vault Health Score (86, +4 this week), Inbox Backlog (17, 9d oldest / 4 need routing), and Task Flow (67%, 12 today / 3 overdue).
4. **Note activity:** a GitHub-style daily creation heatmap from Jul 2025 through Jun 2026, with active-day total and Less/More legend.
5. **Operational lists:** Today Tasks and GitHub Feed, five mock rows each.
6. **Planning shelf:** direct mock links for weekly, monthly, quarterly, yearly, and life plan/review pairs.

## Interaction and data behavior

- Each action button toggles a brief local `Queued`/`Ready` state and updates the small action-status region. It never performs an operation.
- Refresh briefly rotates its icon, updates the displayed time with the browser clock, and re-renders the same mock data.
- Task rows toggle only their local done styling; this state is not persisted.
- Planning links prevent navigation and show a local “Prototype link” status so direct preview remains self-contained.
- When served over HTTP, `script.js` can load `mock-data.json`. When opened as `file://`, it uses an equivalent in-script fallback dataset because browsers normally block JSON fetches from local files. No network request is attempted in file mode.

## Accessibility and responsiveness

- Use native `<button>` and `<a>` elements; all focus states remain visible.
- Respect `prefers-reduced-motion` by removing transitions and spinner motion.
- Desktop layout is optimized for 1180px+ width. Below 960px, metric and list rows wrap; at smaller widths the action rail scrolls horizontally rather than becoming unusably small.

## Verification

- Open `prototype/simple-dashboard/index.html` directly in a browser and verify the entire page renders without a server.
- Verify action buttons, Refresh, task toggles, and planning links visibly change only local UI state.
- Run `npm run build` and `npm run lint`; the static prototype files must not alter the plugin bundle or add dependencies.

## Scope boundaries

- No plugin view, TypeScript source changes, production dependency additions, deploy scripts, network requests, telemetry, Vault reads/writes, or real GitHub/RSS integration.
