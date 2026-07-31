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
	ActivityDay,
	DashboardSnapshot,
	HealthDeduction,
	ParsedTask,
	PeriodLinkKind,
	PeriodLinkTarget,
} from '../domain/dashboard';
import { buildHeatmapLayout, formatLocalDate } from '../domain/dashboard';
import type { ExternalFeedItem } from '../domain/externalFeeds';

export const VIEW_TYPE_AGENT_DASHBOARD = 'agent-dashboard-view';
const DASHBOARD_UPDATED_DATE = '2026-07-30';

const PERIOD_LINK_META: Record<
	PeriodLinkKind,
	{ marker: string; label: string }
> = {
	week: { marker: '周', label: '每周复盘' },
	month: { marker: '月', label: '每月复盘' },
	quarter: { marker: '季', label: '季度复盘' },
	year: { marker: '年', label: '年度复盘' },
};

const MONTH_LABELS_ZH: Record<string, string> = {
	Jan: '1月',
	Feb: '2月',
	Mar: '3月',
	Apr: '4月',
	May: '5月',
	Jun: '6月',
	Jul: '7月',
	Aug: '8月',
	Sep: '9月',
	Oct: '10月',
	Nov: '11月',
	Dec: '12月',
};

interface DashboardAction {
	id: string;
	label: string;
	icon: string;
	kind: 'local' | 'network' | 'write' | 'agent';
}

const DASHBOARD_ACTIONS: readonly DashboardAction[] = [
	{ id: 'new-diary', label: '新建日记', icon: 'notebook-pen', kind: 'write' },
	{ id: 'deep-research', label: '深度研究', icon: 'search', kind: 'agent' },
	{ id: 'pull-rss-feeds', label: '拉取 RSS', icon: 'rss', kind: 'network' },
	{ id: 'github-feeds', label: 'GitHub 动态', icon: 'github', kind: 'network' },
	{ id: 'inbox-ingest', label: '收集到 Inbox', icon: 'inbox', kind: 'write' },
	{ id: 'vault-lint', label: 'Vault 检查', icon: 'scan-search', kind: 'write' },
];

export interface AgentDashboardController {
	getPluginVersion(): string;
	getDashboardState(): DashboardDataState;
	getExternalFeedState(): ExternalFeedState;
	getAgentTaskState(): AgentTaskState;
	subscribeDashboard(listener: (state: DashboardDataState) => void): () => void;
	subscribeExternalFeed(listener: (state: ExternalFeedState) => void): () => void;
	subscribeAgentTask(listener: (state: AgentTaskState) => void): () => void;
	refreshDashboard(): Promise<void>;
	runDashboardAction(actionId: string): Promise<void>;
	openTask(task: ParsedTask): Promise<void>;
	openDailyNote(day: ActivityDay): Promise<void>;
	openPeriodLink(target: PeriodLinkTarget): Promise<void>;
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
		return '智能体仪表盘';
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
		const activityLayout = dashboardEl.createDiv({
			cls: 'agent-dashboard__activity-layout',
		});
		this.renderHeatmap(activityLayout);
		this.renderPeriodLinks(activityLayout);
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
			text: '智能体知识库',
		});
		identityEl.createEl('h1', {
			cls: 'agent-dashboard__title',
			text: 'Sean 的智能体仪表盘',
		});

		const controlsEl = headerEl.createDiv({
			cls: 'agent-dashboard__controls',
		});
		controlsEl.createSpan({
			cls: 'agent-dashboard__build',
			text: `v${this.controller.getPluginVersion()} · 更新于 ${DASHBOARD_UPDATED_DATE}`,
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
			text: '刷新',
			attr: {
				'aria-label': '刷新本地 vault 指标',
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
			attr: { 'aria-label': '仪表盘快捷操作' },
		});
		this.renderSectionKicker(
			sectionEl,
			'快捷操作',
			'外部操作均需明确确认',
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
			attr: { 'aria-label': '本地智能体任务状态' },
		});
		const iconEl = runEl.createSpan({ cls: 'agent-dashboard__agent-run-icon' });
		setIcon(iconEl, this.agentState.status === 'running' ? 'loader-circle' : 'bot');
		const bodyEl = runEl.createDiv({ cls: 'agent-dashboard__agent-run-body' });
		bodyEl.createEl('strong', {
			text:
				this.agentState.status === 'running'
					? '本地智能体运行中'
					: `本地智能体${this.getAgentStatusLabel()}`,
		});
		bodyEl.createSpan({
			text:
				this.agentState.error ??
				this.agentState.output.trim().split(/\r?\n/u).at(-1) ??
				this.agentState.topic ??
				'暂无输出',
		});
		if (this.agentState.status === 'running') {
			const cancelButton = runEl.createEl('button', {
				text: '取消',
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
			attr: { 'aria-label': 'Vault 概览' },
		});
		this.renderSectionKicker(
			sectionEl,
			'知识库状态',
			new Date().toLocaleDateString('zh-CN', {
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
				label: '知识库健康度',
				value: snapshot ? String(snapshot.health.score) : '—',
				detail: snapshot
					? this.formatHealthDetail(snapshot.health.deductions)
					: '等待本地扫描',
				icon: 'heart-pulse',
				accent: 'mint',
			},
			{
				label: 'Inbox 待处理',
				value: snapshot
					? snapshot.paths.inbox.exists
						? String(snapshot.inbox.count)
						: '—'
					: '—',
				detail: snapshot
					? !snapshot.paths.inbox.exists
						? `路径不存在：${snapshot.paths.inbox.configuredPath}`
						: snapshot.inbox.count === 0
							? 'Inbox 已清空'
							: `最早已等待 ${snapshot.inbox.oldestDays} 天`
					: '等待本地扫描',
				icon: 'inbox',
				accent: 'sand',
			},
			{
				label: '任务流',
				value: snapshot ? `${snapshot.taskFlow.rate}%` : '—',
				detail: snapshot
					? `${snapshot.taskFlow.total} 项到期，${snapshot.taskFlow.overdue} 项逾期`
					: '等待本地扫描',
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

		if (
			snapshot &&
			(!snapshot.paths.daily.exists || !snapshot.paths.inbox.exists)
		) {
			this.renderPathNotice(sectionEl, snapshot);
		}

		if (snapshot && snapshot.health.deductions.length > 0) {
			const breakdownEl = sectionEl.createDiv({
				cls: 'agent-dashboard__health-breakdown',
				attr: { 'aria-label': 'Vault 健康度扣分项' },
			});
			breakdownEl.createSpan({ text: '评分模型' });
			for (const deduction of snapshot.health.deductions) {
				breakdownEl.createSpan({
					cls: 'agent-dashboard__health-chip',
					text: `−${deduction.points} ${this.getHealthDeductionLabel(deduction)}`,
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
			text: '笔记创建 / 每日信号',
		});
		titleEl.createEl('h2', {
			cls: 'agent-dashboard__card-title',
			attr: { id: 'agent-dashboard-note-creation' },
			text: '笔记创建热力图',
		});
		const snapshot = this.dashboardState.snapshot;
		headerEl.createEl('p', {
			cls: 'agent-dashboard__activity-stat',
			text: snapshot
				? `${snapshot.activeNoteDays} 个活跃日 · ${snapshot.noteCount} 篇笔记`
				: '正在扫描本地笔记历史',
		});

		const heatmapFrame = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-frame',
		});
		const activity = snapshot?.activity ?? [];
		const layout = buildHeatmapLayout(activity);
		const monthByColumn = new Map(
			layout.months.map((month) => [
				month.column,
				MONTH_LABELS_ZH[month.label] ?? month.label,
			]),
		);
		const monthsEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__months',
			attr: { 'aria-hidden': 'true' },
		});
		for (let column = 0; column < 53; column += 1) {
			monthsEl.createSpan({ text: monthByColumn.get(column) ?? '' });
		}

		const heatmapBodyEl = heatmapFrame.createDiv({
			cls: 'agent-dashboard__heatmap-body',
		});
		const weekdaysEl = heatmapBodyEl.createDiv({
			cls: 'agent-dashboard__weekdays',
			attr: { 'aria-hidden': 'true' },
		});
		for (const label of ['', '一', '', '三', '', '五', '']) {
			weekdaysEl.createSpan({ text: label });
		}

		const gridEl = heatmapBodyEl.createDiv({
			cls: 'agent-dashboard__heatmap-grid',
			attr: {
				'aria-label': '最近 365 天的每日笔记创建活跃度',
				'aria-colcount': '53',
				'aria-rowcount': '7',
				role: 'grid',
			},
		});
		const maximum = Math.max(...activity.map((day) => day.count), 1);
		const today = formatLocalDate(new Date());
		const dayButtonsByDate = new Map<string, HTMLButtonElement>();
		let dayButtons: HTMLButtonElement[] = [];
		if (activity.length > 0) {
			for (let rowIndex = 0; rowIndex < 7; rowIndex += 1) {
				const rowEl = gridEl.createDiv({
					cls: 'agent-dashboard__heatmap-row',
					attr: {
						'aria-rowindex': String(rowIndex + 1),
						role: 'row',
					},
				});
				for (let columnIndex = 0; columnIndex < 53; columnIndex += 1) {
					const day = layout.cells[columnIndex * 7 + rowIndex];
					if (!day) {
						rowEl.createSpan({
							cls: 'agent-dashboard__activity-cell agent-dashboard__activity-cell--empty',
							attr: { 'aria-hidden': 'true' },
						});
						continue;
					}
					const level =
						day.count === 0
							? 0
							: Math.max(1, Math.ceil((day.count / maximum) * 4));
					const hasDailyNote = day.dailyNotePath !== null;
					const isToday = day.date === today;
					const statusText = hasDailyNote
						? '已有日记，按回车打开'
						: '日记不存在';
					const dayLabel = isToday ? `${day.date}，今天` : day.date;
					const attributes: Record<string, string> = {
						'aria-colindex': String(columnIndex + 1),
						...(isToday ? { 'aria-current': 'date' } : {}),
						'aria-label': `${dayLabel}：创建 ${day.count} 篇笔记；${statusText}`,
						'aria-rowindex': String(rowIndex + 1),
						role: 'gridcell',
						title: `${dayLabel} · ${day.count} 篇笔记 · ${statusText}`,
						type: 'button',
					};
					const buttonEl = rowEl.createEl('button', {
						cls: [
							'agent-dashboard__activity-cell',
							`agent-dashboard__activity-cell--${level}`,
							hasDailyNote ? 'has-diary' : '',
							isToday ? 'is-today' : '',
						]
							.filter(Boolean)
							.join(' '),
						attr: attributes,
					});
					buttonEl.tabIndex = isToday ? 0 : -1;
					dayButtonsByDate.set(day.date, buttonEl);
					this.registerRenderEvent(buttonEl, 'click', () => {
						void this.controller.openDailyNote(day);
					});
					this.registerRenderEvent(buttonEl, 'keydown', (event) => {
						const currentIndex = dayButtons.indexOf(buttonEl);
						let nextIndex = currentIndex;
						switch (event.key) {
							case 'ArrowUp':
								nextIndex -= 1;
								break;
							case 'ArrowDown':
								nextIndex += 1;
								break;
							case 'ArrowLeft':
								nextIndex -= 7;
								break;
							case 'ArrowRight':
								nextIndex += 7;
								break;
							case 'Home':
								nextIndex = 0;
								break;
							case 'End':
								nextIndex = dayButtons.length - 1;
								break;
							default:
								return;
						}
						event.preventDefault();
						const nextButton =
							dayButtons[
								Math.min(
									Math.max(nextIndex, 0),
									dayButtons.length - 1,
								)
							];
						if (!nextButton || nextButton === buttonEl) return;
						buttonEl.tabIndex = -1;
						nextButton.tabIndex = 0;
						nextButton.focus();
					});
				}
			}
			dayButtons = activity
				.map((day) => dayButtonsByDate.get(day.date))
				.filter(
					(button): button is HTMLButtonElement =>
						button !== undefined,
				);
		}
		if (
			dayButtons.length > 0 &&
			!dayButtons.some((button) => button.tabIndex === 0)
		) {
			const latestButton = dayButtons.at(-1);
			if (latestButton) latestButton.tabIndex = 0;
		}
		if (activity.length === 0) {
			gridEl.createDiv({
				cls: 'agent-dashboard__empty agent-dashboard__empty--heatmap',
				text:
					this.dashboardState.status === 'error'
						? this.dashboardState.error ?? 'Vault 扫描失败'
						: '正在生成本地活跃度图…',
			});
		}

		const footerEl = sectionEl.createDiv({
			cls: 'agent-dashboard__heatmap-footer',
		});
		footerEl.createEl('p', {
			text: '每格代表本地一天；带边框日期可打开日记，笔记内容不会离开此设备。',
		});
		const legendEl = footerEl.createDiv({
			cls: 'agent-dashboard__legend',
			attr: { 'aria-label': '活跃强度图例' },
		});
		legendEl.createSpan({ text: '少' });
		for (const level of [0, 1, 2, 3, 4]) {
			legendEl.createSpan({
				cls: `agent-dashboard__activity-cell agent-dashboard__activity-cell--${level}`,
			});
		}
		legendEl.createSpan({ text: '多' });
	}

	private renderPeriodLinks(containerEl: HTMLElement): void {
		const sectionEl = containerEl.createEl('section', {
			cls: 'agent-dashboard__period-card',
			attr: { 'aria-labelledby': 'agent-dashboard-review-cadence' },
		});
		const headerEl = sectionEl.createDiv({
			cls: 'agent-dashboard__card-header',
		});
		const titleEl = headerEl.createDiv();
		titleEl.createEl('p', {
			cls: 'agent-dashboard__eyebrow',
			text: '计划 / 复盘',
		});
		titleEl.createEl('h2', {
			cls: 'agent-dashboard__card-title',
			attr: { id: 'agent-dashboard-review-cadence' },
			text: '周期复盘',
		});
		headerEl.createSpan({
			cls: 'agent-dashboard__header-mark',
			text: '本地',
		});

		const listEl = sectionEl.createDiv({
			cls: 'agent-dashboard__period-list',
		});
		const periodLinks = this.dashboardState.snapshot?.periodLinks ?? [];
		if (periodLinks.length === 0) {
			this.renderEmpty(listEl, '正在定位本地复盘笔记…');
			return;
		}

		for (const target of periodLinks) {
			const meta = PERIOD_LINK_META[target.kind];
			const isMissing = target.status === 'missing';
			const buttonEl = listEl.createEl('button', {
				cls: `agent-dashboard__period-row is-${target.status}`,
				attr: {
					'aria-label': isMissing
						? `未找到${meta.label}`
						: `打开${meta.label}：${target.displayTarget}${
								target.status === 'fallback'
									? '（最近一期）'
									: ''
							}`,
					type: 'button',
				},
			});
			buttonEl.disabled = isMissing;
			buttonEl.createSpan({
				cls: 'agent-dashboard__period-marker',
				attr: { 'aria-hidden': 'true' },
				text: meta.marker,
			});
			const bodyEl = buttonEl.createSpan({
				cls: 'agent-dashboard__period-body',
			});
			bodyEl.createEl('strong', { text: meta.label });
			bodyEl.createEl('small', { text: target.displayTarget });
			const endEl = buttonEl.createSpan({
				cls: 'agent-dashboard__period-end',
			});
			if (target.status === 'fallback') {
				endEl.createSpan({
					cls: 'agent-dashboard__period-status',
					text: '最近一期',
				});
			} else if (isMissing) {
				endEl.createSpan({
					cls: 'agent-dashboard__period-status',
					text: '未找到',
				});
			} else {
				setIcon(endEl, 'arrow-up-right');
			}

			if (!isMissing) {
				this.registerRenderEvent(buttonEl, 'click', () => {
					void this.controller.openPeriodLink(target);
				});
			}
		}
	}

	private renderTasks(containerEl: HTMLElement): void {
		const tasks = this.dashboardState.snapshot?.tasks.slice(0, 5) ?? [];
		const cardEl = this.createListCard(
			containerEl,
			`今天 / 显示 ${tasks.length} 项`,
			'今日任务',
			'本地',
		);
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__task-list',
		});

		if (tasks.length === 0) {
			this.renderEmpty(
				listEl,
				this.dashboardState.status === 'loading'
					? '正在扫描有日期的任务…'
					: '今天没有到期任务，可在每日笔记中添加。',
			);
			return;
		}

		for (const task of tasks) {
			const taskButton = listEl.createEl('button', {
				cls: 'agent-dashboard__task-row',
				attr: {
					'aria-label': `打开任务来源：${task.filePath}`,
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
				text: this.getTaskStatusLabel(task.status),
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
			'外部信息 / 已确认',
			'GitHub 与 RSS 信息流',
			'公开',
		);
		const listEl = cardEl.createDiv({
			cls: 'agent-dashboard__feed-list',
		});

		if (items.length === 0) {
			this.renderEmpty(
				listEl,
				this.feedState.loadingSource
					? `正在刷新 ${this.feedState.loadingSource.toUpperCase()}…`
					: this.feedState.error ??
							'暂无缓存信息，请使用 GitHub 动态或拉取 RSS 获取公开数据。',
			);
			return;
		}

		for (const item of items) {
			const feedButton = listEl.createEl('button', {
				cls: 'agent-dashboard__feed-row',
				attr: {
					'aria-label': `打开外部信息：${item.title}`,
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
				return '扫描中';
			case 'error':
				return '需要处理';
			case 'ready':
				return '在线';
			default:
				return '启动中';
		}
	}

	private getSyncLabel(): string {
		const timestamp = this.dashboardState.snapshot?.generatedAt;
		if (!timestamp) return '尚未同步';
		return `本地同步 ${new Date(timestamp).toLocaleTimeString('zh-CN', {
			hour: '2-digit',
			minute: '2-digit',
		})}`;
	}

	private getAccessibleStatus(): string {
		if (this.dashboardState.status === 'error') {
			return this.dashboardState.error ?? 'Vault 扫描失败。';
		}
		if (this.agentState.status === 'running') {
			return `本地智能体运行中：${this.agentState.topic ?? '研究任务'}。`;
		}
		return `仪表盘状态：${this.getStatusLabel()}。`;
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
			return '仅桌面端';
		}
		if (action.id === 'deep-research' && this.agentState.status === 'running') {
			return '运行中';
		}
		if (
			action.id === 'github-feeds' &&
			this.feedState.loadingSource === 'github'
		) {
			return '加载中';
		}
		if (
			action.id === 'pull-rss-feeds' &&
			this.feedState.loadingSource === 'rss'
		) {
			return '加载中';
		}
		return {
			local: '仅本地',
			network: '确认后联网',
			write: '确认后写入',
			agent: '确认后运行',
		}[action.kind];
	}

	private formatHealthDetail(deductions: HealthDeduction[]): string {
		if (deductions.length === 0) return '当前无扣分项';
		return deductions
			.slice(0, 2)
			.map((item) => `−${item.points} ${this.getHealthDeductionLabel(item)}`)
			.join(' · ');
	}

	private getHealthDeductionLabel(deduction: HealthDeduction): string {
		return {
			inbox: 'Inbox 积压',
			activity: '近期活跃度偏低',
			orphans: '缺少链接或标签',
			overdue: '逾期任务',
		}[deduction.id];
	}

	private getTaskStatusLabel(status: 'done' | 'overdue' | 'todo'): string {
		return {
			done: '完成',
			overdue: '逾期',
			todo: '待办',
		}[status];
	}

	private getAgentStatusLabel(): string {
		return {
			idle: '待命',
			running: '运行中',
			succeeded: '已完成',
			failed: '失败',
			cancelled: '已取消',
		}[this.agentState.status];
	}

	private renderPathNotice(
		containerEl: HTMLElement,
		snapshot: DashboardSnapshot,
	): void {
		const noticeEl = containerEl.createDiv({
			cls: 'agent-dashboard__path-notice',
			attr: { role: 'note' },
		});
		const iconEl = noticeEl.createSpan({
			cls: 'agent-dashboard__path-notice-icon',
		});
		setIcon(iconEl, 'folder-cog');
		const bodyEl = noticeEl.createDiv({
			cls: 'agent-dashboard__path-notice-body',
		});
		bodyEl.createEl('strong', { text: '需要设置 vault 路径' });
		const messages = [
			!snapshot.paths.daily.exists
				? this.formatPathSuggestion('每日笔记', snapshot.paths.daily)
				: null,
			!snapshot.paths.inbox.exists
				? this.formatPathSuggestion('Inbox', snapshot.paths.inbox)
				: null,
		].filter((message): message is string => message !== null);
		bodyEl.createEl('p', {
			text: `${messages.join(' · ')}。请打开“设置 → Agent Dashboard”确认。`,
		});
	}

	private formatPathSuggestion(
		label: string,
		diagnostic: DashboardSnapshot['paths']['daily'],
	): string {
		const candidate = diagnostic.candidates[0];
		return candidate
			? `${label}：可尝试 ${candidate}`
			: `${label}：未找到 ${diagnostic.configuredPath}`;
	}
}
