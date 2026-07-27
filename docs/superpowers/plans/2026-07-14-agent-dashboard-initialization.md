# Agent Dashboard Initialization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the current directory as a minimal TypeScript Obsidian community plugin named `Agent Dashboard`, install the requested project skills, and verify the build/lint workflow.

**Architecture:** Copy the official sample plugin source and configuration into the current directory without its Git history. Update only the plugin/package metadata required by the specification, place the requested skills under a project-local skills directory, and add identical agent guidance files.

**Tech Stack:** TypeScript, Obsidian public API, npm, esbuild, ESLint, Git.

---

### Task 1: Import the official sample plugin

**Files:** Current project directory; temporary checkout outside the project.

- [ ] Clone `https://github.com/obsidianmd/obsidian-sample-plugin` into a temporary directory.
- [ ] Copy all source/configuration files into `E:\Code\ObsidianDashboard`, excluding the source `.git` directory and any temporary checkout metadata.
- [ ] Confirm the project has no inherited Git history and optionally run `git init` in the current directory only.

### Task 2: Install and verify the existing toolchain

**Files:** `package-lock.json` and files changed only if a minimal build/lint fix is required.

- [ ] Run `npm install` without adding packages.
- [ ] Run `npm run build`; if it fails, inspect the actual error and make the smallest source/configuration correction.
- [ ] If `package.json` defines `lint`, run `npm run lint` and make only a minimal correction if needed.

### Task 3: Normalize plugin metadata

**Files:** `manifest.json`, `package.json`, `versions.json`, and only other directly related metadata files if present.

- [ ] Set the required ID, display name, package name, version, minimum app version, description, author, and desktop flag.
- [ ] Keep version mappings consistent at `0.1.0` and preserve unrelated fields.

### Task 4: Install project-local skills and agent instructions

**Files:** Project-local skill directories, `AGENTS.md`, `CLAUDE.md`.

- [ ] Install the `frontend-design` skill from the Anthropic repository and the `obsidian-plugin-skill` from the gapmiss repository into a clearly named project-local skills directory.
- [ ] Create identical concise `AGENTS.md` and `CLAUDE.md` files containing the user-specified project rules.

### Task 5: Final verification

**Files:** No additional production files.

- [ ] Run `npm run build` again and run `npm run lint` again when the script exists.
- [ ] Verify no remote is configured, no commit was created, metadata is consistent, the two skill directories exist, and both guidance files are byte-identical.
- [ ] Report the project path, initialization, Git, npm, metadata, skills, docs, and next-step results.
