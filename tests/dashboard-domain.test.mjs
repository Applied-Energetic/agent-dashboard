import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

function loadTypeScriptModule(entryPoint) {
	const result = buildSync({
		entryPoints: [entryPoint],
		bundle: true,
		format: 'cjs',
		platform: 'node',
		target: 'node20',
		write: false,
	});
	const module = { exports: {} };
	const execute = new Function('module', 'exports', result.outputFiles[0].text);
	execute(module, module.exports);
	return module.exports;
}

const {
	buildActivityDays,
	buildHeatmapLayout,
	buildPeriodLinkpaths,
	buildPeriodLinkTargets,
	calculateHealthScore,
	calculateTaskFlow,
	createDashboardSnapshot,
	diagnoseDashboardFolders,
	parseMarkdownTasks,
	resolveNoteCreatedAt,
} = loadTypeScriptModule('src/domain/dashboard.ts');
const { normalizeGitHubPayloads } = loadTypeScriptModule(
	'src/domain/externalFeeds.ts',
);
const { buildDiaryContent, sanitizeFileName } = loadTypeScriptModule(
	'src/domain/vaultActions.ts',
);
const { buildAgentCommand } = loadTypeScriptModule(
	'src/domain/agentTasks.ts',
);

test('parses standard markdown tasks and due dates', () => {
	const tasks = parseMarkdownTasks(
		'Daily/2026-07-27.md',
		[
			'- [ ] Ship dashboard 📅 2026-07-27',
			'- [x] Review yesterday',
			'ordinary list item',
		].join('\n'),
	);

	assert.deepEqual(tasks, [
		{
			filePath: 'Daily/2026-07-27.md',
			line: 0,
			title: 'Ship dashboard',
			done: false,
			dueDate: '2026-07-27',
		},
		{
			filePath: 'Daily/2026-07-27.md',
			line: 1,
			title: 'Review yesterday',
			done: true,
		},
	]);
});

test('renders markdown task titles as readable plain text', () => {
	const [task] = parseMarkdownTasks(
		'Daily/2026-07-27.md',
		'- [ ] **Review** [[Projects/Agent Dashboard|project plan]] #短期目标 `draft`',
	);

	assert.equal(task.title, 'Review project plan 短期目标 draft');
});

test('resolves note creation dates from frontmatter, filename, then ctime', () => {
	const now = new Date('2026-07-28T12:00:00+08:00');
	const ctime = new Date('2026-07-20T08:00:00+08:00').getTime();

	const frontmatterDate = resolveNoteCreatedAt(
		{
			path: 'Notes/copied.md',
			ctime,
			frontmatterCreated: '2026-07-01',
		},
		now,
	);
	const filenameDate = resolveNoteCreatedAt(
		{
			path: '06_Dairy日记/2026-07-12.md',
			ctime,
			frontmatterCreated: 'not-a-date',
		},
		now,
	);
	const ctimeDate = resolveNoteCreatedAt(
		{
			path: 'Notes/undated.md',
			ctime,
			frontmatterCreated: '2027-01-01',
		},
		now,
	);

	assert.equal(new Date(frontmatterDate).getDate(), 1);
	assert.equal(new Date(filenameDate).getDate(), 12);
	assert.equal(ctimeDate, ctime);
});

test('builds a continuous 365 day activity series', () => {
	const activity = buildActivityDays(
		[
			{ createdAt: new Date('2026-07-27T09:00:00+08:00').getTime() },
			{ createdAt: new Date('2026-07-27T12:00:00+08:00').getTime() },
			{ createdAt: new Date('2026-07-26T09:00:00+08:00').getTime() },
		],
		new Date('2026-07-27T18:00:00+08:00'),
	);

	assert.equal(activity.length, 365);
	assert.deepEqual(activity.at(-1), {
		date: '2026-07-27',
		count: 2,
		dailyNotePath: null,
	});
	assert.deepEqual(activity.at(-2), {
		date: '2026-07-26',
		count: 1,
		dailyNotePath: null,
	});
});

test('aligns heatmap cells to natural weeks without skipping months', () => {
	const activity = buildActivityDays(
		[],
		new Date('2026-07-28T18:00:00+08:00'),
	);
	const layout = buildHeatmapLayout(activity);

	assert.equal(layout.cells.length, 371);
	assert.equal(layout.cells.filter(Boolean).length, 365);
	assert.deepEqual(layout.cells.slice(0, 3), [
		null,
		null,
		{ date: '2025-07-29', count: 0, dailyNotePath: null },
	]);
	assert.deepEqual(
		layout.months.map((month) => month.label),
		[
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec',
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
		],
	);
});

test('resolves nested date-named notes inside the configured daily folder', () => {
	const dailyPath = 'Daily/2026/07/2026-07-28.md';
	const activity = buildActivityDays(
		[
			{
				path: dailyPath,
				createdAt: new Date('2026-07-28T09:00:00+08:00').getTime(),
			},
		],
		new Date('2026-07-28T18:00:00+08:00'),
		['Daily'],
	);

	assert.equal(activity.at(-1).dailyNotePath, dailyPath);
});

test('selects the lexicographically first daily note path for duplicate dates', () => {
	const activity = buildActivityDays(
		[
			{
				path: 'Daily/Z/2026-07-28.md',
				createdAt: new Date('2026-07-28T09:00:00+08:00').getTime(),
			},
			{
				path: 'Daily/A/2026-07-28.md',
				createdAt: new Date('2026-07-28T10:00:00+08:00').getTime(),
			},
		],
		new Date('2026-07-28T18:00:00+08:00'),
		['Daily'],
	);

	assert.equal(activity.at(-1).dailyNotePath, 'Daily/A/2026-07-28.md');
});

test('does not resolve date-named notes outside the selected daily folder', () => {
	const activity = buildActivityDays(
		[
			{
				path: 'Archive/2026-07-28.md',
				createdAt: new Date('2026-07-28T09:00:00+08:00').getTime(),
			},
		],
		new Date('2026-07-28T18:00:00+08:00'),
		['Daily'],
	);

	assert.equal(activity.at(-1).dailyNotePath, null);
});

test('uses the first diagnosed daily folder when the configured folder is missing', () => {
	const dailyPath = '06_Dairy日记/2026年7月/2026-07-28.md';
	const snapshot = createDashboardSnapshot(
		[
			{
				path: dailyPath,
				createdAt: new Date('2026-07-28T09:00:00+08:00').getTime(),
				modifiedAt: new Date('2026-07-28T10:00:00+08:00').getTime(),
				linkCount: 1,
				tagCount: 0,
				tasks: [],
			},
		],
		{ dailyFolder: 'Daily', inboxFolder: 'Inbox' },
		new Date('2026-07-28T18:00:00+08:00'),
		['06_Dairy日记', '06_Dairy日记/2026年7月'],
	);

	assert.equal(snapshot.paths.daily.exists, false);
	assert.equal(snapshot.activity.at(-1).dailyNotePath, dailyPath);
});

test('diagnoses missing dashboard folders and suggests vault matches', () => {
	const paths = diagnoseDashboardFolders(
		{
			dailyFolder: 'Daily',
			inboxFolder: 'Inbox',
		},
		['01_Inbox_收集箱', '06_Dairy日记', '06_Dairy日记/2026年7月'],
	);

	assert.equal(paths.daily.exists, false);
	assert.deepEqual(paths.daily.candidates, ['06_Dairy日记']);
	assert.equal(paths.inbox.exists, false);
	assert.deepEqual(paths.inbox.candidates, ['01_Inbox_收集箱']);
});

const PERIOD_LINK_TEMPLATES = {
	week: '{{YYYY}}-W{{WW}}',
	month: '{{YYYY}}-{{MM}}月计划',
	quarter: '{{YYYY}}-Q{{Q}}',
	year: '{{YYYY}}年度曼陀罗计划',
};

test('builds period linkpaths with ISO week-year boundaries', () => {
	const linkpaths = buildPeriodLinkpaths(
		PERIOD_LINK_TEMPLATES,
		new Date('2027-01-01T12:00:00+08:00'),
	);

	assert.deepEqual(linkpaths, {
		week: '2026-W53',
		month: '2027-01月计划',
		quarter: '2027-Q1',
		year: '2027年度曼陀罗计划',
	});
});

test('resolves current period files before fallback candidates', () => {
	const targets = buildPeriodLinkTargets(
		[
			{ path: 'Reviews/2026-W30.md' },
			{ path: 'Reviews/2026-06月计划.md' },
		],
		PERIOD_LINK_TEMPLATES,
		new Date('2026-07-30T12:00:00+08:00'),
		{
			week: '08_Review_复盘/2026/每周计划/2026-W31.md',
			month: '08_Review_复盘/2026/月度计划/2026-07月计划.md',
			quarter: '08_Review_复盘/2026/2026-Q3.md',
			year: '08_Review_复盘/年度计划与总结/2026年度曼陀罗计划.md',
		},
	);

	assert.deepEqual(
		targets.map((target) => ({
			kind: target.kind,
			status: target.status,
			displayTarget: target.displayTarget,
		})),
		[
			{ kind: 'week', status: 'current', displayTarget: '2026-W31' },
			{ kind: 'month', status: 'current', displayTarget: '2026-07月计划' },
			{ kind: 'quarter', status: 'current', displayTarget: '2026-Q3' },
			{ kind: 'year', status: 'current', displayTarget: '2026年度曼陀罗计划' },
		],
	);
});

test('uses the latest past period and never a future fallback', () => {
	const [week] = buildPeriodLinkTargets(
		[
			{ path: 'Reviews/2026-W29.md' },
			{ path: 'Reviews/2026-W30.md' },
			{ path: 'Reviews/2026-W32.md' },
		],
		PERIOD_LINK_TEMPLATES,
		new Date('2026-07-30T12:00:00+08:00'),
	).filter((target) => target.kind === 'week');

	assert.equal(week.status, 'fallback');
	assert.equal(week.displayTarget, '2026-W30');
	assert.equal(week.filePath, 'Reviews/2026-W30.md');
});

test('selects a deterministic path when period files are duplicated', () => {
	const [week] = buildPeriodLinkTargets(
		[
			{ path: 'Reviews/Z/2026-W30.md' },
			{ path: 'Reviews/A/2026-W30.md' },
		],
		PERIOD_LINK_TEMPLATES,
		new Date('2026-07-30T12:00:00+08:00'),
	).filter((target) => target.kind === 'week');

	assert.equal(week.status, 'fallback');
	assert.equal(week.filePath, 'Reviews/A/2026-W30.md');
});

test('marks a period link missing when no matching file exists', () => {
	const targets = buildPeriodLinkTargets(
		[],
		PERIOD_LINK_TEMPLATES,
		new Date('2026-07-30T12:00:00+08:00'),
	);

	assert.equal(targets.length, 4);
	assert.ok(targets.every((target) => target.status === 'missing'));
	assert.ok(targets.every((target) => target.filePath === null));
});

test('calculates task flow from today and overdue tasks', () => {
	const flow = calculateTaskFlow(
		[
			{ done: true, dueDate: '2026-07-27', filePath: 'A.md', line: 0, title: 'A' },
			{ done: false, dueDate: '2026-07-27', filePath: 'B.md', line: 0, title: 'B' },
			{ done: false, dueDate: '2026-07-26', filePath: 'C.md', line: 0, title: 'C' },
			{ done: false, dueDate: '2026-07-28', filePath: 'D.md', line: 0, title: 'D' },
		],
		'2026-07-27',
	);

	assert.deepEqual(flow, {
		completed: 1,
		overdue: 1,
		rate: 33,
		total: 3,
	});
});

test('health score returns transparent deductions', () => {
	const health = calculateHealthScore({
		activeDaysLast30: 5,
		inboxCount: 7,
		orphanRatio: 0.4,
		overdueTasks: 2,
	});

	assert.equal(health.score, 69);
	assert.deepEqual(
		health.deductions.map((item) => item.points),
		[7, 6, 10, 8],
	);
});

test('creates a real dashboard snapshot from normalized note records', () => {
	const periodLinks = buildPeriodLinkTargets(
		[],
		PERIOD_LINK_TEMPLATES,
		new Date('2026-07-27T12:00:00+08:00'),
	);
	const snapshot = createDashboardSnapshot(
		[
			{
				path: 'Daily/2026-07-27.md',
				createdAt: new Date('2026-07-27T08:00:00+08:00').getTime(),
				modifiedAt: new Date('2026-07-27T09:00:00+08:00').getTime(),
				linkCount: 1,
				tagCount: 0,
				tasks: [
					{
						filePath: 'Daily/2026-07-27.md',
						line: 2,
						title: 'Today task',
						done: false,
					},
				],
			},
			{
				path: 'Inbox/capture.md',
				createdAt: new Date('2026-07-20T08:00:00+08:00').getTime(),
				modifiedAt: new Date('2026-07-20T08:00:00+08:00').getTime(),
				linkCount: 0,
				tagCount: 0,
				tasks: [
					{
						filePath: 'Inbox/capture.md',
						line: 0,
						title: 'Overdue task',
						done: false,
						dueDate: '2026-07-26',
					},
				],
			},
		],
		{
			dailyFolder: 'Daily',
			inboxFolder: 'Inbox',
		},
		new Date('2026-07-27T12:00:00+08:00'),
		['Daily', 'Inbox'],
		periodLinks,
	);

	assert.equal(snapshot.noteCount, 2);
	assert.equal(snapshot.paths.daily.exists, true);
	assert.equal(snapshot.paths.inbox.exists, true);
	assert.deepEqual(snapshot.periodLinks, periodLinks);
	assert.deepEqual(snapshot.inbox, { count: 1, oldestDays: 7 });
	assert.equal(snapshot.tasks.length, 2);
	assert.equal(snapshot.tasks[0].status, 'overdue');
	assert.equal(snapshot.taskFlow.overdue, 1);
	assert.equal(snapshot.activity.at(-1).count, 1);
});

test('normalizes public GitHub repository payloads without credentials', () => {
	const items = normalizeGitHubPayloads([
		{
			full_name: 'openai/codex',
			description: 'Agentic coding',
			html_url: 'https://github.com/openai/codex',
			stargazers_count: 123,
			updated_at: '2026-07-27T08:00:00Z',
		},
		{
			items: [
				{
					full_name: 'anthropics/skills',
					description: null,
					html_url: 'https://github.com/anthropics/skills',
					stargazers_count: 42,
					updated_at: '2026-07-26T08:00:00Z',
				},
			],
		},
	]);

	assert.deepEqual(
		items.map((item) => ({
			title: item.title,
			summary: item.summary,
			meta: item.meta,
		})),
		[
			{
				title: 'openai/codex',
				summary: 'Agentic coding',
				meta: '123 stars',
			},
			{
				title: 'anthropics/skills',
				summary: 'Public GitHub repository',
				meta: '42 stars',
			},
		],
	);
});

test('builds safe Vault filenames and deterministic diary content', () => {
	assert.equal(sanitizeFileName('  Research: agents / 2026  '), 'Research agents 2026');
	assert.equal(
		buildDiaryContent('2026-07-27'),
		'# 2026-07-27\n\n## Tasks\n\n- [ ] \n\n## Notes\n',
	);
});

test('builds provider-specific read-only CLI argument arrays', () => {
	const codex = buildAgentCommand('codex', 'codex', 'Agent memory');
	const claude = buildAgentCommand('claude', 'claude', 'Agent memory');

	assert.equal(codex.command, 'codex');
	assert.deepEqual(codex.args.slice(0, 4), [
		'exec',
		'--sandbox',
		'read-only',
		'--skip-git-repo-check',
	]);
	assert.equal(claude.command, 'claude');
	assert.deepEqual(claude.args.slice(-2), ['--permission-mode', 'plan']);
	assert.match(codex.preview, /read-only/u);
});
