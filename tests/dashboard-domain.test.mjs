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
	calculateHealthScore,
	calculateTaskFlow,
	createDashboardSnapshot,
	parseMarkdownTasks,
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
	assert.deepEqual(activity.at(-1), { date: '2026-07-27', count: 2 });
	assert.deepEqual(activity.at(-2), { date: '2026-07-26', count: 1 });
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
	);

	assert.equal(snapshot.noteCount, 2);
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
