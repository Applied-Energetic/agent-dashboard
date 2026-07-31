import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardSource = readFileSync(
	new URL('../src/views/AgentDashboardView.ts', import.meta.url),
	'utf8',
);
const dashboardDataServiceSource = readFileSync(
	new URL('../src/services/DashboardDataService.ts', import.meta.url),
	'utf8',
);
const dashboardStyles = readFileSync(
	new URL('../styles.css', import.meta.url),
	'utf8',
);

test('uses Chinese copy for the primary dashboard interface', () => {
	for (const copy of [
		'智能体知识库',
		'刷新',
		'周期复盘',
		'今日任务',
		'本地同步',
	]) {
		assert.match(dashboardSource, new RegExp(copy, 'u'));
	}

	for (const legacyCopy of [
		'Weekly review',
		'Vault note creation',
		'Today tasks',
		'Review cadence',
	]) {
		assert.doesNotMatch(dashboardSource, new RegExp(legacyCopy, 'u'));
	}
});

test('loads nested Vault folders for daily-note path diagnostics', () => {
	assert.match(dashboardDataServiceSource, /\.getAllLoadedFiles\(\)/u);
	assert.doesNotMatch(dashboardDataServiceSource, /\.getRoot\(\)\s*\.children/u);
});

test('uses complete ARIA grid semantics for the heatmap', () => {
	assert.match(dashboardSource, /role:\s*'row'/u);
	assert.match(dashboardSource, /'aria-current':\s*'date'/u);
});

test('keeps button resets lower-specificity than component styles', () => {
	assert.match(
		dashboardStyles,
		/\.agent-dashboard-view\s+:where\(\s*button\.agent-dashboard__refresh/u,
	);
	assert.doesNotMatch(
		dashboardStyles,
		/\.agent-dashboard-view\s+button\.agent-dashboard__refresh,/u,
	);
});
