# Interactive Heatmap Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current static activity grid with an accessible, native interactive heatmap that opens existing daily notes, while removing all shadows and refining the Dashboard into a flat Apple-like glass interface.

**Architecture:** Extend the Dashboard domain snapshot with a resolved Vault-relative daily-note path for each activity day. Render the heatmap as a 53-week native button grid with month and weekday labels, keyboard navigation, and clear current-day/note-available states. Opening a heatmap day remains in the ItemView controller and only uses Obsidian public APIs; missing notes produce a Notice and never create or modify files.

**Tech Stack:** TypeScript, Obsidian public API, native HTML/CSS, Node test runner, esbuild, ESLint.

---

## Task 1: Resolve daily-note paths in the Dashboard snapshot

**Files:**
- Modify: `src/domain/dashboard.ts`
- Test: `tests/dashboard-domain.test.mjs`

**Step 1: Write failing domain tests**

Add tests covering:

- A note named `YYYY-MM-DD.md` nested below the configured daily folder resolves to its Vault-relative path.
- When the configured folder is missing, the first diagnosed daily-folder candidate is used.
- Duplicate date-named notes resolve deterministically to the lexicographically first path.
- A day without a matching daily note returns `dailyNotePath: null`.

Update existing `ActivityDay` expectations to include `dailyNotePath`.

**Step 2: Run the focused tests and confirm failure**

Run:

```powershell
node --test tests/dashboard-domain.test.mjs
```

Expected: failures because `ActivityDay` does not yet expose `dailyNotePath`.

**Step 3: Implement the minimal domain change**

- Add `dailyNotePath: string | null` to `ActivityDay`.
- Allow `buildActivityDays` note inputs to include an optional `path`.
- Resolve exact `YYYY-MM-DD.md` basenames only within the selected daily folder, recursively.
- Select the configured daily folder when it exists; otherwise use the first diagnosed candidate.
- Sort or compare paths so duplicate matches always select the lexicographically first Vault-relative path.
- Compute folder diagnostics before activity data in `createDashboardSnapshot`.

**Step 4: Re-run the focused tests**

Run:

```powershell
node --test tests/dashboard-domain.test.mjs
```

Expected: all Dashboard domain tests pass.

## Task 2: Render an accessible interactive heatmap

**Files:**
- Modify: `src/views/AgentDashboardView.ts`
- Test: `tests/dashboard-domain.test.mjs`

**Step 1: Extend the ItemView controller contract**

Add:

```ts
openDailyNote(day: ActivityDay): Promise<void>;
```

Import `ActivityDay` and the existing local-date formatter from the domain module.

**Step 2: Replace static cells with native controls**

In `renderHeatmap`:

- Keep the existing 365-day/53-week layout.
- Add weekday labels `一 / 三 / 五` alongside the seven rows.
- Keep month labels aligned to week columns.
- Render real days as `button[type="button"]` with `role="gridcell"`.
- Preserve padded cells as non-interactive, aria-hidden elements.
- Add level classes, `has-diary`, and `is-today` states.
- Set Chinese `title` and `aria-label` text containing date, note count, and daily-note availability.
- Call `controller.openDailyNote(day)` on click.

**Step 3: Add roving keyboard navigation**

- Give only today’s cell `tabIndex=0`.
- Support Up/Down by one day, Left/Right by seven days, and Home/End for first/last day.
- Clamp navigation at the available date range.
- Move focus and the active tab stop together.
- Keep native Enter/Space activation.

**Step 4: Run type-aware checks later with the full test suite**

The repository has no DOM unit-test harness, so verify the rendering contract through TypeScript build/lint and visual inspection after deployment.

## Task 3: Open existing daily notes without changing the Vault

**Files:**
- Modify: `src/main.ts`

**Step 1: Implement `openDailyNote`**

- If `dailyNotePath` is null, show a Chinese Notice and return.
- Resolve the path using Obsidian’s Vault API and require a `TFile`.
- If the file moved or disappeared, show a Notice, refresh the Dashboard snapshot, and return.
- Reuse and reveal an already-open Markdown leaf for the same file.
- Otherwise open the note in a new tab leaf.
- Preserve the Dashboard and every other existing tab.

**Step 2: Keep scope narrow**

Do not create daily notes, modify notes, register a new view, change command/ribbon behavior, or add dependencies.

## Task 4: Convert the visual system to flat Apple-like glass

**Files:**
- Modify: `styles.css`

**Step 1: Remove all shadow styling**

- Delete every `box-shadow` declaration, including `box-shadow: none`.
- Do not add transform/scale hover effects.
- Remove any unused highlight token that only supported inner shadows.

**Step 2: Refine glass surfaces**

- Use translucent Obsidian theme-color mixes for controls and cards.
- Apply restrained `backdrop-filter: blur(16px) saturate(125%)`.
- Keep 1px borders, small radii, and flat hover/focus state changes.
- Reduce ambient background color intensity.
- Preserve compatibility with Obsidian light mode and avoid a separate grid/background board.

**Step 3: Style the heatmap**

- Use 11–13px square cells and 3px gaps.
- Add a fixed weekday-label rail.
- Use five accent-tinted intensity levels.
- Distinguish available daily notes with a subtle border.
- Outline today and keyboard focus without shadows.
- Allow horizontal scrolling at narrow widths while preserving the weekly grid.

**Step 4: Verify shadow removal**

Run:

```powershell
rg -n "box-shadow|translateY|scale\(" styles.css
```

Expected: no matches.

## Task 5: Release metadata, verification, and local deployment

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `versions.json`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Step 1: Bump release metadata**

- Change version from `0.1.3` to `0.1.4`.
- Keep release date `2026-07-30`.
- Add a concise Chinese `0.1.4` changelog entry for the interactive daily-note heatmap and shadowless glass styling.
- Keep `AGENTS.md` and `CLAUDE.md` content identical.

**Step 2: Run the complete verification suite**

Run:

```powershell
npm test
npm run build
npm run lint
```

Expected: all commands exit successfully.

**Step 3: Inspect generated artifacts and repository state**

Run:

```powershell
git diff --check
git status --short
```

Confirm `main.js`, `manifest.json`, and `styles.css` are current and no unrelated files were modified.

**Step 4: Deploy only the plugin artifacts**

- Read `%APPDATA%\obsidian\obsidian.json` to locate the currently open `Blog_backup` Vault.
- Copy only `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/agent-dashboard`.
- Verify copied file hashes match the project artifacts.
- Do not commit, push, create a remote, or publish.
