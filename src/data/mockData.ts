export interface DashboardAction {
	id: string;
	label: string;
	icon: string;
}

export interface DashboardMetric {
	label: string;
	value: string;
	detail: string;
	icon: string;
	accent: 'mint' | 'sand' | 'lime';
}

export interface DashboardTask {
	id: string;
	title: string;
	meta: string;
	status: 'done' | 'doing' | 'todo';
	done: boolean;
}

export interface DashboardFeedItem {
	repository: string;
	message: string;
	meta: string;
}

export const DASHBOARD_ACTIONS: readonly DashboardAction[] = [
	{ id: 'new-diary', label: 'New diary', icon: 'notebook-pen' },
	{ id: 'deep-research', label: 'Deep research', icon: 'search' },
	{ id: 'pull-rss-feeds', label: 'Pull RSS feeds', icon: 'rss' },
	{ id: 'github-feeds', label: 'GitHub feeds', icon: 'github' },
	{ id: 'inbox-ingest', label: 'Inbox ingest', icon: 'inbox' },
	{ id: 'vault-lint', label: 'Vault lint', icon: 'scan-search' },
];

export const DASHBOARD_METRICS: readonly DashboardMetric[] = [
	{
		label: 'Vault health score',
		value: '86',
		detail: '+4 this week',
		icon: 'heart-pulse',
		accent: 'mint',
	},
	{
		label: 'Inbox backlog',
		value: '17',
		detail: '9d oldest, 4 need routing',
		icon: 'inbox',
		accent: 'sand',
	},
	{
		label: 'Task flow',
		value: '67%',
		detail: '12 today, 3 overdue',
		icon: 'list-checks',
		accent: 'lime',
	},
];

export const DASHBOARD_ACTIVITY: readonly number[] = Array.from(
	{ length: 365 },
	(_, index) => {
		if (index % 73 >= 36) return 0;
		if (index % 11 === 0) return 4;
		if (index % 7 === 0) return 3;
		if (index % 5 === 0) return 2;
		return 1;
	},
);

export const DASHBOARD_TASKS: readonly DashboardTask[] = [
	{
		id: 'weekly-review',
		title: 'Finish weekly plan and review',
		meta: '45 min focus block',
		status: 'doing',
		done: false,
	},
	{
		id: 'research-inbox',
		title: 'Route research notes from inbox',
		meta: '4 notes need routing',
		status: 'todo',
		done: false,
	},
	{
		id: 'agent-session',
		title: "Review yesterday's agent session",
		meta: 'Session #042',
		status: 'todo',
		done: false,
	},
	{
		id: 'reading-note',
		title: 'Capture reading note on agent memory',
		meta: 'Linked to #ai',
		status: 'done',
		done: true,
	},
	{
		id: 'daily-diary',
		title: "Write today's diary entry",
		meta: 'Before 20:00',
		status: 'todo',
		done: false,
	},
];

export const DASHBOARD_GITHUB_FEED: readonly DashboardFeedItem[] = [
	{
		repository: 'obsidianmd/obsidian-api',
		message: 'Type definitions updated for workspace events',
		meta: '2h ago · 184 stars',
	},
	{
		repository: 'anthropics/skills',
		message: 'New reference patterns for agent-facing UI',
		meta: '4h ago · 92 stars',
	},
	{
		repository: 'openai/codex',
		message: 'Discussion: durable local workflow context',
		meta: '6h ago · 58 comments',
	},
	{
		repository: 'modelcontextprotocol/specification',
		message: 'Lifecycle clarification merged',
		meta: 'Yesterday · 31 stars',
	},
	{
		repository: 'sindresorhus/awesome',
		message: 'Added knowledge management tooling',
		meta: 'Yesterday · 12 stars',
	},
];
