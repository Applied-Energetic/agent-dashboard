import {
	Component,
	ItemView,
	Platform,
	setIcon,
	type WorkspaceLeaf,
} from 'obsidian';
import type {
	DashboardDataState,
} from '../services/DashboardDataService';
import type {
	ExternalFeedState,
} from '../services/ExternalFeedService';
import type {
	AgentTaskState,
} from '../services/AgentTaskService';
import type {
	DashboardSnapshot,
	HealthDeduction,
	ParsedTask,
} from '../domain/dashboard';
import type { ExternalFeedItem } from '../domain/externalFeeds';

export const VIEW_TYPE_AGENT_DASHBOARD = 'agent-dashboard-view';

interface DashboardAction {
	id: string;
	label: string;
	icon: string;
	kind: 'local' | 'network' | 'write' | 'agent';
}

const DASHBOARD_ACTIONS: readonly DashboardAction[] = [
	{ id: 'new-diary', label: 'New diary', icon: 'notebook-pen', kind: 'write' },
	{ id: 'deep-research', label: 'Deep research', icon: 'search', kind: 'agent' },
	{ id: 'pull-rss-feeds', label: 'Pull RSS feeds', icon: 'rss', kind: 'network' },
	{ id: 'github-feeds', label: 'GitHub feeds', icon: 'github', kind: 'network' },
	{ id: 'inbox-ingest', label: 'Inbox ingest', icon: 'inbox', kind: 'write' },
	{ id: 'vault-lint', label: 'Vault lint', icon: 'scan-search', kind: 'write' },
];

export interface AgentDashboardController {
	getDashboardState(): DashboardDataState;
	getExternalFeedState(): ExternalFeedState;
	getAgentTaskState(): AgentTaskState;
	subscribeDashboard(listener: (state: DashboardDataState) => void): () => void;
	subscribeExternalFeed(listener: (state: ExternalFeedState) => void): () => void;
	subscribeAgentTask(listener: (state: AgentTaskState) => void): () => void;
	refreshDashboard(): Promise<void>;
	runDashboardAction(actionId: string): Promise<void>;
	openTask(task: ParsedTask): Promise<void>;
	openExternalItem(item: ExternalFeedItem): void;
	cancelAgentTask(): void;
}

export class AgentDashboardView extends ItemView {
	private renderScope: Component | null = null;
	private dashboardState: DashboardDataState;
	private feedState: ExternalFeedState;
	private agentState: AgentTaskState;
	private renderQueued = false;
	private opened = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly controller: AgentDashboardController,
	) {
		super(leaf);
		this.dashboardState = controller.getDashboardState();
		this.feedState = controller.getExternalFeedState();
		this.agentState = controller.getAgentTaskState();
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT_DASHBOARD;
	}

	getDisplayText(): string {
		return 'Agent dashboard';
	}

	getIcon(): string {
		return 'layout-dashboard';
	}

	onOpen(): Promise<void> {
		this.opened = true;
		const unsubscribers = [
			this.controller.subscribeDashboard((state) => {
				this.dashboardState = state;
				this.queueRender();
			}),
			this.controller.subscribeExternalFeed((state) => {
				this.feedState = state;
				this.queueRender();
			}),
			this.controller.subscribeAgentTask((state) => {
				this.agentState = state;
				this.queueRender();
			}),
		];
		this.register(() => {
			for (const unsubscribe of unsubscribers) unsubscribe();
		});
		this.renderDashboard();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.opened = false;
		this.clearRenderScope();
		this.contentEl.empty();
		return Promise.resolve();
	}

	private queueRender(): void {
		if (this.renderQueued || !this.opened) return;
		this.renderQueued = true;
		const viewWindow = this.contentEl.ownerDocument.defaultView;
		if (!viewWindow) {
			this.renderQueued = false;
			this.renderDashboard();
			return;
		}
		viewWindow.requestAnimationFrame(() => {
			this.renderQueued = false;
			if (this.opened) this.renderDashboard();
		});
	}

	private renderDashboard(): void {
		this.clearRenderScope();
		this.renderScope = new Component();
		this.addChild(this.renderScope);
		this.contentEl.empty();
		this.contentEl.addClass('agent-dashboard-view');

		const dashboardEl = this.contentEl.createDiv({
			cls: 'agent-dashboard',
		});
		dashboardEl.createDiv({
			cls: 'agent-dashboard__status',
			attr: {
				'aria-atomic': 'true',
				'aria-live': 'polite',
				role: 'status',
			},
			text: this.getAccessibleStatus(),
		});

		this.renderHeader(dashboardEl);
		this.renderAlerts(dashboardEl);
		this.renderActions(dashboardEl);
		this.renderAgentRun(dashboardEl);
		this.renderStats(dashboardEl);
		this.renderHeatmap(dashboardEl);
		const operationsGrid = dashboardEl.createDiv({
			cls: 'agent-dashboard__operations-grid',
		});
		this.renderTasks(operationsGrid);
		this.renderGitHubFeed(operationsGrid);
	}

	private renderHeader(containerEl: HTMLElement): void {
		const headerEl = containerEl.createEl('header', {
			cls: 'agent-dashboard__header',
		});
		const identityEl = headerEl.createDiv({
			cls: 'agent-dashboard__identity',
		});
		identityEl.createEl('p', {
			cls: 'agent-dashboard__eyebrow',
			text: 'Agentic vault',
		});
		identityEl.createEl('h1', {
			cls: 'agent-dashboard__title',
			text: "Sean's agent dashboard",
		});

		const controlsEl = headerEl.createDiv({
			cls: 'agent-dashboard__controls',
		});
		const liveEl = controlsEl.createSpan({
			cls: `agent-dashboard__live is-${this.dashboardState.status}`,
			text: this.getStatusLabel(),
		});
		liveEl.createSpan({ cls: 'agent-dashboard__live-dot' });
		controlsEl.createSpan({
			cls: 'agent-dashboard__sync',
			text: this.getSyncLabel(),
		});

		const refreshButton = controlsEl.createEl('button', {
			cls: 'agent-dashboard__refresh',
			text: 'Refresh',
			attr: {
				'aria-label': 'Refresh local vault metrics',
				'data-tooltip-position': 'bottom',
				type: 'button',
			},
		});
		refreshButton.disabled = this.dashboardState.status === 'loading';
		const refreshIcon = refreshButton.createSpan({
			cls: 'agent-dashboard__refresh-icon',
		});
		setIcon(refreshIcon, 'refresh-cw');
		this.registerRenderEvent(refreshButton, 'click', () => {
			void this.controller.refreshDashboard();
		});
	}

	private renderActions(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__section agent-dashboard__actions-section',
			attr: { 'aria-label': 'Dashboard actions' },
		});
		this.renderSectionKicker(
			sectionEl,
			'Quick operations',
			'Explicit confirmation for external actions',
		);
		const actionRail = sectionEl.createDiv({
			cls: 'agent-dashboard__action-rail',
		});

		for (const action of DASHBOARD_ACTIONS) {
			const actionButton = actionRail.createEl('button', {
				cls: `agent-dashboard__action-button is-${action.kind}`,
				attr: {
					'data-action-id': action.id,
					type: 'button',
				},
			});
			const disabled = this.isActionBusy(action.id);
			actionButton.disabled = disabled;
			const iconEl = actionButton.createSpan({
				cls: 'agent-dashboard__action-icon',
			});
			setIcon(iconEl, action.icon);
			actionButton.createSpan({
				cls: 'agent-dashboard__action-label',
				text: action.label,
			});
			actionButton.createEl('small', {
				cls: 'agent-dashboard__action-state',
				text: this.getActionState(action),
			});

			this.registerRenderEvent(actionButton, 'click', () => {
				void this.controller.runDashboardAction(action.id);
			});
		}
	}

	private renderAlerts(containerEl: HTMLElement): void {
		const errors = [
			this.dashboardState.error,
			this.feedState.error,
			this.agentState.error,
		].filter((message): message is string => Boolean(message));
		if (errors.length === 0) return;

		const alertEl = containerEl.createDiv({
			cls: 'agent-dashboard__inline-alert',
			attr: { role: 'alert' },
		});
		const iconEl = alertEl.createSpan();
		setIcon(iconEl, 'triangle-alert');
		alertEl.createEl('p', { text: errors.join(' · ') });
	}

	private renderAgentRun(containerEl: HTMLElement): void {
		if (this.agentState.status === 'idle') return;

		const runEl = containerEl.createEl('section', {
			cls: `agent-dashboard__agent-run is-${this.agentState.status}`,
			attr: { 'aria-label': 'Local agent task status' },
		});
		const iconEl = runEl.createSpan({ cls: 'agent-dashboard__agent-run-icon' });
		setIcon(iconEl, this.agentState.status === 'running' ? 'loader-circle' : 'bot');
		const bodyEl = runEl.createDiv({ cls: 'agent-dashboard__agent-run-body' });
		bodyEl.createEl('strong', {
			text:
				this.agentState.status === 'running'
					? 'Local agent running'
					: `Local agent ${this.agentState.status}`,
		});
		bodyEl.createSpan({
			text:
				this.agentState.error ??
				this.agentState.output.trim().split(/\r?\n/u).at(-1) ??
				this.agentState.topic ??
				'No output yet',
		});
		if (this.agentState.status === 'running') {
			const cancelButton = runEl.createEl('button', {
				text: 'Cancel',
				attr: { type: 'button' },
			});
			this.registerRenderEvent(cancelButton, 'click', () => {
				this.controller.cancelAgentTask();
			});
		}
	}

	private renderStats(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__section',
			attr: { 'aria-label': 'Vault overview' },
		});
		this.renderSectionKicker(
			sectionEl,
			'Vault pulse',
			new Date().toLocaleDateString(undefined, {
				month: '2-digit',
				day: '2-digit',
				year: 'numeric',
				weekday: 'long',
			}),
		);
		const gridEl = sectionEl.createDiv({
			cls: 'agent-dashboard__metric-grid',
		});
		const snapshot = this.dashboardState.snapshot;
		const metrics = [
			{
				label: 'Vault health score',
				value: snapshot ? String(snapshot.health.score) : '—',
				detail: snapshot
					? this.formatHealthDetail(snapshot.health.deductions)
					: 'Waiting for local scan',
				icon: 'heart-pulse',
				accent: 'mint',
			},
			{
				label: 'Inbox backlog',
				value: snapshot ? String(snapshot.inbox.count) : '—',
				detail: snapshot
					? snapshot.inbox.count === 0
						? 'Inbox is clear'
						: `${snapshot.inbox.oldestDays}d oldest`
					: 'Waiting for local scan',
				icon: 'inbox',
				accent: 'sand',
			},
			{
				label: 'Task flow',
				value: snapshot ? `${snapshot.taskFlow.rate}%` : '—',
				detail: snapshot
					? `${snapshot.taskFlow.total} due, ${snapshot.taskFlow.overdue} overdue`
					: 'Waiting for local scan',
				icon: 'list-checks',
				accent: 'lime',
			},
		] as const;

		for (const metric of metrics) {
			const cardEl = gridEl.createEl('article', {
				cls: `agent-dashboard__metric-card agent-dashboard__metric-card--${metric.accent}`,
			});
			const topEl = cardEl.createDiv({
				cls: 'agent-dashboard__metric-top',
			});
			topEl.createSpan({ text: metric.label });
			const iconEl = topEl.createSpan({
				cls: 'agent-dashboard__metric-icon',
			});
			setIcon(iconEl, metric.icon);
			cardEl.createEl('strong', {
				cls: 'agent-dashboard__metric-value',
				text: metric.value,
			});
			cardEl.createEl('p', {
				cls: 'agent-dashboard__metric-detail',
				text: metric.detail,
			});
		}

		if (snapshot && snapshot.health.deductions.length > 0) {
			const breakdownEl = sectionEl.createDiv({
				cls: 'agent-dashboard__health-breakdown',
				attr: { 'aria-label': 'Vault health score deductions' },
			});
			breakdownEl.createSpan({ text: 'Score model' });
			for (const deduction of snapshot.health.deductions) {
				breakdownEl.createSpan({
					cls: 'agent-dashboard__health-chip',
					text: `−${deduction.points} ${deduction.label}`,
				});
			}
		}
	}

	private renderHeatmap(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__heatmap-card',
			attr: { 'aria-labelledby': 'agent-dashboard-note-creation' },
		});
		const headerEl = sectionEl.createDiv({
			cls: 'agent-dashboard__card-header',
		});
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', {
			cls: 'agent-dashboard__eyebrow',
			text: 'Note creation / daily signal',
		});
		titleEl.createEl('h2', {
			cls: 'agent-dashboard__card-title',
			attr: { id: 'agent-dashboard-note-creation' },
			text: 'Vault note creation',
		});
		const snapshot = this.dashboardState.snapshot;
		headerEl.createEl('p', {
			cls: 'agent-dashboard__activity-stat',
			text: snapshot
				? `${snapshot.activeNoteDays} active note days · ${snapshot.noteCount} notes`
				: 'Scanning local note history',
		});

		const heatmapFrame = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-frame',
		});
		const monthsEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__months',
			attr: { 'aria-hidden': 'true' },
		});
		for (const month of this.getHeatmapMonths(snapshot)) {
			monthsEl.createSpan({ text: month });
		}

		const gridEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__heatmap-grid',
			attr: {
				'aria-label': 'Daily note creation activity for the last 365 days',
				role: 'img',
			},
		});
		const activity = snapshot?.activity ?? [];
		const maximum = Math.max(...activity.map((day) => day.count), 1);
		for (const day of activity) {
			const level =
				day.count === 0
					? 0
					: Math.max(1, Math.ceil((day.count / maximum) * 4));
			gridEl.createSpan({
				cls: `agent-dashboard__activity-cell agent-dashboard__activity-cell--${level}`,
				attr: {
					'aria-label': `${day.date}: ${day.count} notes created`,
					title: `${day.date} · ${day.count} notes`,
				},
			});
		}
		if (activity.length === 0) {
			gridEl.createDiv({
				cls: 'agent-dashboard__empty agent-dashboard__empty--heatmap',
				text:
					this.dashboardState.status === 'error'
						? this.dashboardState.error ?? 'Vault scan failed'
						: 'Building the local activity map…',
			});
		}

		const footerEl = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-footer',
		});
		footerEl.createEl('p', {
			text: 'One square = one local day. No note content leaves this device.',
		});
		const legendEl = footerEl.createDiv({
			cls: 'agent-dashboard__legend',
			attr: { 'aria-label': 'Activity intensity legend' },
		});
		legendEl.createSpan({ text: 'Less' });
		for (const level of [0, 1, 2, 3, 4]) {
			legendEl.createSpan({
				cls: `agent-dashboard__activity-cell agent-dashboard__activity-cell--${level}`,
			});
		}
		legendEl.createSpan({ text: 'More' });
	}

	private renderTasks(containerEl: HTMLElement): void {
		const tasks = this.dashboardState.snapshot?.tasks.slice(0, 5) ?? [];
		const cardEl = this.createListCard(
			containerEl,
			`Today / ${tasks.length} visible`,
			'Today tasks',
			'LOCAL',
		);
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__task-list',
		});

		if (tasks.length === 0) {
			this.renderEmpty(
				listEl,
				this.dashboardState.status === 'loading'
					? 'Scanning dated tasks…'
					: 'No tasks are due today. Open a daily note to add one.',
			);
			return;
		}

		for (const task of tasks) {
			const taskButton = listEl.createEl('button', {
				cls: 'agent-dashboard__task-row',
				attr: {
					'aria-label': `Open task in ${task.filePath}`,
					type: 'button',
				},
			});
			const checkEl = taskButton.createSpan({
				cls: 'agent-dashboard__task-check',
				text: task.done ? '✓' : '',
			});
			checkEl.setAttr('aria-hidden', 'true');
			const bodyEl = taskButton.createSpan({
				cls: 'agent-dashboard__task-body',
			});
			bodyEl.createEl('strong', { text: task.title });
			bodyEl.createEl('small', {
				text: `${task.filePath}:${task.line + 1}${task.dueDate ? ` · ${task.dueDate}` : ''}`,
			});
			taskButton.createSpan({
				cls: `agent-dashboard__status-badge agent-dashboard__status-badge--${task.status}`,
				text: task.status,
			});
			taskButton.toggleClass('is-done', task.done);

			this.registerRenderEvent(taskButton, 'click', () => {
				void this.controller.openTask(task);
			});
		}
	}

	private renderGitHubFeed(containerEl: HTMLElement): void {
		const items = this.feedState.items.slice(0, 5);
		const cardEl = this.createListCard(
			containerEl,
			'External signals / confirmed',
			'GitHub & RSS feed',
			'PUBLIC',
		);
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__feed-list',
		});

		if (items.length === 0) {
			this.renderEmpty(
				listEl,
				this.feedState.loadingSource
					? `Refreshing ${this.feedState.loadingSource.toUpperCase()}…`
					: this.feedState.error ??
							'No cached signals. Use GitHub feeds or Pull RSS feeds to load public data.',
			);
			return;
		}

		for (const item of items) {
			const feedButton = listEl.createEl('button', {
				cls: 'agent-dashboard__feed-row',
				attr: {
					'aria-label': `Open external item: ${item.title}`,
					type: 'button',
				},
			});
			const feedMark = feedButton.createSpan({
				cls: 'agent-dashboard__feed-mark',
			});
			setIcon(feedMark, item.source === 'github' ? 'git-fork' : 'rss');
			const bodyEl = feedButton.createSpan({
				cls: 'agent-dashboard__feed-body',
			});
			bodyEl.createEl('strong', { text: item.title });
			bodyEl.createSpan({ text: item.summary });
			const metaEl = feedButton.createSpan({
				cls: 'agent-dashboard__feed-meta',
			});
			metaEl.createEl('small', { text: item.sourceLabel });
			metaEl.createEl('small', { text: item.meta });
			this.registerRenderEvent(feedButton, 'click', () => {
				this.controller.openExternalItem(item);
			});
		}
	}

	private renderSectionKicker(
		containerEl: HTMLElement,
		primary: string,
		secondary: string,
	): void {
		const kickerEl = containerEl.createDiv({
			cls: 'agent-dashboard__section-kicker',
		});
		kickerEl.createSpan({ text: primary });
		kickerEl.createSpan({ text: secondary });
	}

	private createListCard(
		containerEl: HTMLElement,
		eyebrow: string,
		title: string,
		marker: string,
	): HTMLElement {
		const cardEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__list-card',
		});
		const headerEl = cardEl.createDiv({
			cls: 'agent-dashboard__card-header',
		});
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', {
			cls: 'agent-dashboard__eyebrow',
			text: eyebrow,
		});
		titleEl.createEl('h2', {
			cls: 'agent-dashboard__card-title',
			text: title,
		});
		headerEl.createSpan({
			cls: 'agent-dashboard__header-mark',
			text: marker,
		});
		return cardEl;
	}

	private renderEmpty(containerEl: HTMLElement, message: string): void {
		const emptyEl = containerEl.createDiv({
			cls: 'agent-dashboard__empty',
		});
		const iconEl = emptyEl.createSpan();
		setIcon(iconEl, 'circle-dashed');
		emptyEl.createEl('p', { text: message });
	}

	private clearRenderScope(): void {
		if (!this.renderScope) return;
		this.removeChild(this.renderScope);
		this.renderScope = null;
	}

	private registerRenderEvent<K extends keyof HTMLElementEventMap>(
		element: HTMLElement,
		event: K,
		callback: (event: HTMLElementEventMap[K]) => void,
	): void {
		this.renderScope?.registerDomEvent(element, event, callback);
	}

	private getStatusLabel(): string {
		switch (this.dashboardState.status) {
			case 'loading':
				return 'Scanning';
			case 'error':
				return 'Needs attention';
			case 'ready':
				return 'Live';
			default:
				return 'Starting';
		}
	}

	private getSyncLabel(): string {
		const timestamp = this.dashboardState.snapshot?.generatedAt;
		if (!timestamp) return 'Not synced';
		return `Local sync ${new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		})}`;
	}

	private getAccessibleStatus(): string {
		if (this.dashboardState.status === 'error') {
			return this.dashboardState.error ?? 'Vault scan failed.';
		}
		if (this.agentState.status === 'running') {
			return `Local agent running: ${this.agentState.topic ?? 'research task'}.`;
		}
		return `Dashboard ${this.dashboardState.status}.`;
	}

	private isActionBusy(actionId: string): boolean {
		if (actionId === 'deep-research') {
			return this.agentState.status === 'running' || !Platform.isDesktop;
		}
		if (actionId === 'github-feeds') {
			return this.feedState.loadingSource === 'github';
		}
		if (actionId === 'pull-rss-feeds') {
			return this.feedState.loadingSource === 'rss';
		}
		return false;
	}

	private getActionState(action: DashboardAction): string {
		if (action.id === 'deep-research' && !Platform.isDesktop) {
			return 'Desktop only';
		}
		if (action.id === 'deep-research' && this.agentState.status === 'running') {
			return 'Running';
		}
		if (
			action.id === 'github-feeds' &&
			this.feedState.loadingSource === 'github'
		) {
			return 'Loading';
		}
		if (
			action.id === 'pull-rss-feeds' &&
			this.feedState.loadingSource === 'rss'
		) {
			return 'Loading';
		}
		return {
			local: 'Local only',
			network: 'Confirm network',
			write: 'Preview write',
			agent: 'Confirm command',
		}[action.kind];
	}

	private formatHealthDetail(deductions: HealthDeduction[]): string {
		if (deductions.length === 0) return 'No current deductions';
		return deductions
			.slice(0, 2)
			.map((item) => `−${item.points} ${item.label.toLowerCase()}`)
			.join(' · ');
	}

	private getHeatmapMonths(snapshot: DashboardSnapshot | null): string[] {
		if (!snapshot || snapshot.activity.length === 0) {
			return Array.from({ length: 12 }, () => '—');
		}
		const formatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
		return Array.from({ length: 12 }, (_, index) => {
			const activityIndex = Math.min(
				snapshot.activity.length - 1,
				Math.floor((index / 11) * (snapshot.activity.length - 1)),
			);
			const date = snapshot.activity[activityIndex]?.date;
			return date ? formatter.format(new Date(`${date}T12:00:00`)) : '—';
		});
	}
}
