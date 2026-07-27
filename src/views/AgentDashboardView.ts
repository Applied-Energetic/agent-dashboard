import { ItemView, setIcon, type WorkspaceLeaf } from 'obsidian';
import {
	DASHBOARD_ACTIONS,
	DASHBOARD_ACTIVITY,
	DASHBOARD_GITHUB_FEED,
	DASHBOARD_METRICS,
	DASHBOARD_TASKS,
	type DashboardTask,
} from '../data/mockData';

export const VIEW_TYPE_AGENT_DASHBOARD = 'agent-dashboard-view';

export class AgentDashboardView extends ItemView {
	private readonly tasks: DashboardTask[] = DASHBOARD_TASKS.map((task) => ({
		...task,
	}));

	private statusEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
		this.renderDashboard();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.contentEl.empty();
		return Promise.resolve();
	}

	private renderDashboard(): void {
		this.contentEl.empty();
		this.contentEl.addClass('agent-dashboard-view');

		const dashboardEl = this.contentEl.createDiv({
			cls: 'agent-dashboard',
		});
		this.statusEl = dashboardEl.createDiv({
			cls: 'agent-dashboard__status',
			attr: {
				'aria-atomic': 'true',
				'aria-live': 'polite',
				role: 'status',
			},
			text: 'Dashboard ready with mock data.',
		});

		this.renderHeader(dashboardEl);
		this.renderActions(dashboardEl);
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
		const liveEl = controlsEl.createEl('span', {
			cls: 'agent-dashboard__live',
			text: 'Live',
		});
		liveEl.createSpan({ cls: 'agent-dashboard__live-dot' });
		controlsEl.createEl('span', {
			cls: 'agent-dashboard__sync',
			text: 'Last sync 09:42',
		});

		const refreshButton = controlsEl.createEl('button', {
			cls: 'agent-dashboard__refresh',
			text: 'Refresh',
			attr: {
				'aria-label': 'Refresh mock dashboard data',
				'data-tooltip-position': 'bottom',
				type: 'button',
			},
		});
		const refreshIcon = refreshButton.createSpan({
			cls: 'agent-dashboard__refresh-icon',
		});
		setIcon(refreshIcon, 'refresh-cw');
		this.registerDomEvent(refreshButton, 'click', () => {
			refreshButton.toggleClass('is-refreshing', true);
			this.setStatus('Mock dashboard refresh completed.');
			refreshButton.toggleClass('is-refreshing', false);
		});
	}

	private renderActions(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__section agent-dashboard__actions-section',
			attr: { 'aria-label': 'Mock dashboard actions' },
		});
		this.renderSectionKicker(sectionEl, 'Quick operations', 'Local mocks only');
		const actionRail = sectionEl.createDiv({
			cls: 'agent-dashboard__action-rail',
		});

		for (const action of DASHBOARD_ACTIONS) {
			const actionButton = actionRail.createEl('button', {
				cls: 'agent-dashboard__action-button',
				attr: {
					'aria-pressed': 'false',
					'data-action-id': action.id,
					type: 'button',
				},
			});
			const iconEl = actionButton.createSpan({
				cls: 'agent-dashboard__action-icon',
			});
			setIcon(iconEl, action.icon);
			actionButton.createSpan({
				cls: 'agent-dashboard__action-label',
				text: action.label,
			});
			const stateEl = actionButton.createEl('small', {
				cls: 'agent-dashboard__action-state',
				text: 'Ready',
			});

			this.registerDomEvent(actionButton, 'click', () => {
				const isQueued = !actionButton.hasClass('is-queued');
				actionButton.toggleClass('is-queued', isQueued);
				actionButton.setAttr('aria-pressed', String(isQueued));
				stateEl.setText(isQueued ? 'Queued' : 'Ready');
				this.setStatus(`Mock action ${isQueued ? 'queued' : 'reset'}: ${action.label}.`);
			});
		}
	}

	private renderStats(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__section',
			attr: { 'aria-label': 'Vault overview' },
		});
		this.renderSectionKicker(sectionEl, 'Vault pulse', '07.15.2026 / Tuesday');
		const gridEl = sectionEl.createDiv({
			cls: 'agent-dashboard__metric-grid',
		});

		for (const metric of DASHBOARD_METRICS) {
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
		headerEl.createEl('p', {
			cls: 'agent-dashboard__activity-stat',
			text: `${DASHBOARD_ACTIVITY.filter((value) => value > 0).length} active note days, Jul 2025–Jun 2026`,
		});

		const heatmapFrame = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-frame',
		});
		const monthsEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__months',
			attr: { 'aria-hidden': 'true' },
		});
		for (const month of ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']) {
			monthsEl.createSpan({ text: month });
		}

		const gridEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__heatmap-grid',
			attr: {
				'aria-label': 'Mock daily note creation activity heatmap',
				role: 'img',
			},
		});
		for (const [index, value] of DASHBOARD_ACTIVITY.entries()) {
			gridEl.createSpan({
				cls: `agent-dashboard__activity-cell agent-dashboard__activity-cell--${value}`,
				attr: { 'aria-label': `Mock day ${index + 1}: ${value} notes created` },
			});
		}

		const footerEl = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-footer',
		});
		footerEl.createEl('p', {
			text: 'One square = one mock day. No Vault data is read.',
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
		const cardEl = this.createListCard(containerEl, 'Today / 5 items', 'Today tasks', '01');
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__task-list',
		});

		for (const task of this.tasks) {
			const taskButton = listEl.createEl('button', {
				cls: 'agent-dashboard__task-row',
				attr: {
					'aria-pressed': String(task.done),
					type: 'button',
				},
			});
			const checkEl = taskButton.createSpan({
				cls: 'agent-dashboard__task-check',
				text: task.done ? '✓' : '',
			});
			const bodyEl = taskButton.createSpan({
				cls: 'agent-dashboard__task-body',
			});
			bodyEl.createEl('strong', { text: task.title });
			bodyEl.createEl('small', { text: task.meta });
			taskButton.createSpan({
				cls: `agent-dashboard__status-badge agent-dashboard__status-badge--${task.status}`,
				text: task.status,
			});
			taskButton.toggleClass('is-done', task.done);

			this.registerDomEvent(taskButton, 'click', () => {
				task.done = !task.done;
				taskButton.toggleClass('is-done', task.done);
				taskButton.setAttr('aria-pressed', String(task.done));
				checkEl.setText(task.done ? '✓' : '');
				this.setStatus(`${task.done ? 'Completed' : 'Reopened'} mock task: ${task.title}.`);
			});
		}
	}

	private renderGitHubFeed(containerEl: HTMLElement): void {
		const cardEl = this.createListCard(containerEl, 'External signals / mock', 'GitHub feed', '02');
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__feed-list',
		});

		for (const item of DASHBOARD_GITHUB_FEED) {
			const feedEl = listEl.createEl('article', {
				cls: 'agent-dashboard__feed-row',
			});
			feedEl.createSpan({
				cls: 'agent-dashboard__feed-mark',
				text: '↗',
			});
			const bodyEl = feedEl.createDiv({
				cls: 'agent-dashboard__feed-body',
			});
			bodyEl.createEl('strong', { text: item.repository });
			bodyEl.createEl('p', { text: item.message });
			feedEl.createEl('small', { text: item.meta });
		}
	}

	private renderSectionKicker(containerEl: HTMLElement, primary: string, secondary: string): void {
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
		headerEl.createEl('span', {
			cls: 'agent-dashboard__header-mark',
			text: marker,
		});
		return cardEl;
	}

	private setStatus(message: string): void {
		this.statusEl?.setText(message);
	}
}
