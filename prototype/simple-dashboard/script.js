const activity = [4,0,0,0,0,1,0,2,0,0,1,3,0,0,2,1,0,4,0,0,1,2,3,0,0,1,0,0,2,0,1,0,0,3,4,2,0,0,0,0,1,0,2,0,3,1,0,0,0,2,1,4,0,0,0,3,2,0,0,0,1,0,0,2,0,1,3,0,4,0,2,0,0,0,0,1,0,3,0,0,1,0,0,0,2,4,0,0,3,0,1,2,0,0,0,1,0,0,2,3,1,0,4,0,0,2,0,0,0,0,3,0,2,0,0,1,0,0,0,4,1,3,0,0,0,1,2,0,0,0,1,0,3,2,0,1,4,0,0,0,2,0,0,3,0,1,0,2,0,0,1,0,0,4,3,1,0,0,0,0,1,2,0,0,0,3,0,0,2,0,4,0,0,0,0,2,3,0,0,0,1,0,2,0,0,1,0,4,0,2,1,0,0,0,0,1,2,0,3,0,1,0,0,2,4,1,0,0,0,3,2,0,0,0,0,1,0,2,0,0,3,4,0,0,2,1,0,0,0,0,1,3,0,0,0,1,0,0,4,0,1,0,3,0,0,2,0,0,0,0,1,0,2,3,0,4,0,0,0,2,1,0,0,0,3,1,2,0,0,0,1,0,4,2,0,3,0,0,0,0,2,0,0,0,0,1,3,2,0,4,1,0,0,0,2,1,0,3,0,0,1,2,0,0,0,1,4,0,3,0,1,0,0,0,0,2,0,0,0,3,1,0,2,4,0,1,0,0,0,2,3,0,0,0,0,1,2,0,0,0,4,3,0,2,0,1,0,0,0,0,2,0,3,0,0,1,0,4,0,0,1,0,0,3,2];

export const FALLBACK_DATA = {
	syncTime: '09:42',
	actions: ['New Diary', 'Deep Research', 'Pull RSS Feeds', 'GitHub Feeds', 'Inbox Ingest', 'Vault Lint'],
	metrics: [
		{ label: 'Vault Health Score', value: '86', detail: '+4 this week', accent: 'mint', icon: 'pulse' },
		{ label: 'Inbox Backlog', value: '17', detail: '9d oldest, 4 need routing', accent: 'sand', icon: 'inbox' },
		{ label: 'Task Flow', value: '67%', detail: '12 today, 3 overdue', accent: 'lime', icon: 'flow' },
	],
	activityStart: '2025-07-01',
	activity,
	tasks: [
		{ id: 'weekly-review', title: 'Finish weekly plan and review', status: 'doing', meta: '45 min focus block', done: false },
		{ id: 'research-inbox', title: 'Route research notes from inbox', status: 'todo', meta: '4 notes need routing', done: false },
		{ id: 'agent-session', title: "Review yesterday's agent session", status: 'todo', meta: 'Session #042', done: false },
		{ id: 'reading-note', title: 'Capture reading note on agent memory', status: 'done', meta: 'Linked to #ai', done: true },
		{ id: 'daily-diary', title: "Write today's diary entry", status: 'todo', meta: 'Before 20:00', done: false },
	],
	githubFeed: [
		{ repo: 'obsidianmd/obsidian-api', message: 'Type definitions updated for workspace events', meta: '2h ago · 184 ★' },
		{ repo: 'anthropics/skills', message: 'New reference patterns for agent-facing UI', meta: '4h ago · 92 ★' },
		{ repo: 'openai/codex', message: 'Discussion: durable local workflow context', meta: '6h ago · 58 comments' },
		{ repo: 'modelcontextprotocol/specification', message: 'Lifecycle clarification merged', meta: 'Yesterday · 31 ★' },
		{ repo: 'sindresorhus/awesome', message: 'Added knowledge management tooling', meta: 'Yesterday · 12 ★' },
	],
	planningLinks: [
		{ title: 'Weekly plan', kind: 'PLAN' }, { title: 'Weekly review', kind: 'REVIEW' },
		{ title: 'Monthly plan', kind: 'PLAN' }, { title: 'Monthly review', kind: 'REVIEW' },
		{ title: 'Quarterly plan', kind: 'PLAN' }, { title: 'Quarterly review', kind: 'REVIEW' },
		{ title: 'Yearly plan', kind: 'PLAN' }, { title: 'Yearly review', kind: 'REVIEW' },
		{ title: 'Life plan', kind: 'PLAN' }, { title: 'Life goals review', kind: 'REVIEW' },
	],
};

export function getHeatmapLevel(value) {
	return Math.max(0, Math.min(4, Math.round(value)));
}

export function formatSyncTime(date) {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `Last sync ${hours}:${minutes}`;
}

async function loadData() {
	if (window.location.protocol === 'file:') return FALLBACK_DATA;

	try {
		const response = await fetch('./mock-data.json');
		if (!response.ok) throw new Error('Mock data was unavailable.');
		return await response.json();
	} catch {
		return FALLBACK_DATA;
	}
}

function createDate(start, offset) {
	const date = new Date(`${start}T12:00:00`);
	date.setDate(date.getDate() + offset);
	return date;
}

function setStatus(message) {
	document.querySelector('#prototype-status').textContent = message;
}

function renderMetrics(metrics) {
	document.querySelector('#metric-grid').innerHTML = metrics.map((metric) => `
		<article class="metric-card metric-card--${metric.accent}">
			<div class="metric-card__top"><span>${metric.label}</span><span class="metric-icon metric-icon--${metric.icon}" aria-hidden="true"></span></div>
			<strong>${metric.value}</strong>
			<p>${metric.detail}</p>
		</article>
	`).join('');
}

function renderActions(actions) {
	document.querySelector('#action-rail').innerHTML = actions.map((action) => `
		<button type="button" class="action-button" data-action="${action}">
			<span>${action}</span><small>Ready</small>
		</button>
	`).join('');
}

function renderHeatmap(data) {
	const grid = document.querySelector('#activity-grid');
	grid.innerHTML = '';
	const fragment = document.createDocumentFragment();

	data.activity.forEach((value, index) => {
		const date = createDate(data.activityStart, index);
		const cell = document.createElement('span');
		cell.className = `activity-cell activity-cell--${getHeatmapLevel(value)}`;
		cell.title = `${date.toLocaleDateString()} · ${value} notes created`;
		cell.setAttribute('aria-label', cell.title);
		fragment.append(cell);
	});

	grid.append(fragment);
	document.querySelector('#active-day-count').textContent = `${data.activity.filter((value) => value > 0).length} active note days, Jul 2025–Jun 2026`;
}

function renderTasks(data) {
	document.querySelector('#tasks-list').innerHTML = data.tasks.map((task) => `
		<button type="button" class="task-row ${task.done ? 'is-done' : ''}" data-task-id="${task.id}">
			<span class="task-row__check" aria-hidden="true">${task.done ? '✓' : ''}</span>
			<span class="task-row__body"><strong>${task.title}</strong><small>${task.meta}</small></span>
			<span class="status-badge status-badge--${task.status}">${task.status}</span>
		</button>
	`).join('');
}

function renderGitHubFeed(feed) {
	document.querySelector('#github-list').innerHTML = feed.map((item) => `
		<article class="feed-row"><span class="feed-row__mark" aria-hidden="true">↗</span><div><strong>${item.repo}</strong><p>${item.message}</p></div><small>${item.meta}</small></article>
	`).join('');
}

function renderPlanningLinks(links) {
	document.querySelector('#planning-links').innerHTML = links.map((link) => `
		<a href="#${link.title.toLowerCase().replaceAll(' ', '-')}" data-plan-link><span>${link.title}</span><small>${link.kind}</small></a>
	`).join('');
}

function registerInteractions(data) {
	document.querySelector('#action-rail').addEventListener('click', (event) => {
		const button = event.target.closest('[data-action]');
		if (!button) return;
		button.classList.add('is-queued');
		button.querySelector('small').textContent = 'Queued';
		setStatus(`Mock action queued: ${button.dataset.action}`);
		window.setTimeout(() => {
			button.classList.remove('is-queued');
			button.querySelector('small').textContent = 'Ready';
		}, 850);
	});

	document.querySelector('#tasks-list').addEventListener('click', (event) => {
		const row = event.target.closest('[data-task-id]');
		if (!row) return;
		const task = data.tasks.find((item) => item.id === row.dataset.taskId);
		task.done = !task.done;
		renderTasks(data);
		setStatus(`${task.done ? 'Completed' : 'Reopened'}: ${task.title}`);
	});

	document.querySelector('#planning-links').addEventListener('click', (event) => {
		const link = event.target.closest('[data-plan-link]');
		if (!link) return;
		event.preventDefault();
		setStatus(`Prototype link: ${link.querySelector('span').textContent}`);
	});

	document.querySelector('#refresh-button').addEventListener('click', (event) => {
		const button = event.currentTarget;
		button.classList.add('is-refreshing');
		document.querySelector('#sync-time').textContent = formatSyncTime(new Date());
		setStatus('Dashboard refreshed with local mock data.');
		window.setTimeout(() => button.classList.remove('is-refreshing'), 500);
	});
}

async function initializeDashboard() {
	const data = await loadData();
	document.querySelector('#sync-time').textContent = `Last sync ${data.syncTime}`;
	renderActions(data.actions);
	renderMetrics(data.metrics);
	renderHeatmap(data);
	renderTasks(data);
	renderGitHubFeed(data.githubFeed);
	renderPlanningLinks(data.planningLinks);
	registerInteractions(data);
}

if (typeof document !== 'undefined') {
	void initializeDashboard();
}
