import {
	MarkdownView,
	Notice,
	Platform,
	Plugin,
	TFile,
	normalizePath,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	AgentDashboardSettingTab,
	type AgentDashboardSettings,
} from './settings';
import {
	AgentDashboardView,
	VIEW_TYPE_AGENT_DASHBOARD,
	type AgentDashboardController,
} from './views/AgentDashboardView';
import {
	DashboardDataService,
	type DashboardDataState,
} from './services/DashboardDataService';
import {
	ExternalFeedService,
	type ExternalFeedCache,
	type ExternalFeedState,
} from './services/ExternalFeedService';
import {
	AgentTaskService,
	type AgentTaskState,
} from './services/AgentTaskService';
import { VaultActionService } from './services/VaultActionService';
import {
	CaptureModal,
	ConfirmationModal,
	TopicModal,
} from './ui/modals';
import type {
	ActivityDay,
	ParsedTask,
	PeriodLinkTarget,
} from './domain/dashboard';
import type { ExternalFeedItem } from './domain/externalFeeds';

interface StoredPluginData {
	settings: AgentDashboardSettings;
	externalCache: ExternalFeedCache;
}

const EMPTY_EXTERNAL_CACHE: ExternalFeedCache = {
	items: [],
	refreshedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isExternalFeedItem(value: unknown): value is ExternalFeedItem {
	if (!isRecord(value)) return false;
	return (
		(value.source === 'github' || value.source === 'rss') &&
		typeof value.id === 'string' &&
		typeof value.sourceLabel === 'string' &&
		typeof value.title === 'string' &&
		typeof value.summary === 'string' &&
		typeof value.url === 'string' &&
		typeof value.publishedAt === 'string' &&
		typeof value.meta === 'string'
	);
}

export default class AgentDashboardPlugin
	extends Plugin
	implements AgentDashboardController
{
	settings!: AgentDashboardSettings;
	private externalCache: ExternalFeedCache = EMPTY_EXTERNAL_CACHE;
	private dashboardDataService!: DashboardDataService;
	private externalFeedService!: ExternalFeedService;
	private agentTaskService!: AgentTaskService;
	private vaultActionService!: VaultActionService;

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.dashboardDataService = new DashboardDataService(
			this.app,
			() => this.settings,
		);
		this.addChild(this.dashboardDataService);
		this.externalFeedService = new ExternalFeedService(
			() => this.settings,
			this.externalCache,
			() => this.app.workspace.containerEl.ownerDocument.defaultView,
			async (cache) => {
				this.externalCache = cache;
				await this.savePluginData();
			},
		);
		this.agentTaskService = new AgentTaskService(
			() => this.settings,
			() => this.app.workspace.containerEl.ownerDocument.defaultView,
		);
		this.vaultActionService = new VaultActionService(
			this.app,
			() => this.settings,
		);

		this.registerView(
			VIEW_TYPE_AGENT_DASHBOARD,
			(leaf) => new AgentDashboardView(leaf, this),
		);

		this.addRibbonIcon('layout-dashboard', '打开智能体仪表盘', () => {
			void this.activateDashboardView();
		});

		this.addCommand({
			id: 'open-modal-simple',
			name: '打开仪表盘',
			callback: () => {
				void this.activateDashboardView();
			},
		});

		this.addCommand({
			id: 'replace-selected',
			name: '从编辑器打开仪表盘',
			editorCallback: () => {
				void this.activateDashboardView();
			},
		});

		this.addCommand({
			id: 'open-modal-complex',
			name: '有活动笔记时打开仪表盘',
			checkCallback: (checking: boolean) => {
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!markdownView) return false;
				if (!checking) void this.activateDashboardView();
				return true;
			},
		});

		this.addSettingTab(new AgentDashboardSettingTab(this.app, this));
	}

	onunload(): void {
		this.agentTaskService?.dispose();
	}

	getDashboardState(): DashboardDataState {
		return this.dashboardDataService.getState();
	}

	getPluginVersion(): string {
		return this.manifest.version;
	}

	getExternalFeedState(): ExternalFeedState {
		return this.externalFeedService.getState();
	}

	getAgentTaskState(): AgentTaskState {
		return this.agentTaskService.getState();
	}

	subscribeDashboard(listener: (state: DashboardDataState) => void): () => void {
		return this.dashboardDataService.subscribe(listener);
	}

	subscribeExternalFeed(
		listener: (state: ExternalFeedState) => void,
	): () => void {
		return this.externalFeedService.subscribe(listener);
	}

	subscribeAgentTask(listener: (state: AgentTaskState) => void): () => void {
		return this.agentTaskService.subscribe(listener);
	}

	async refreshDashboard(): Promise<void> {
		await this.dashboardDataService.refresh();
	}

	async saveSettings(): Promise<void> {
		await this.savePluginData();
	}

	async runDashboardAction(actionId: string): Promise<void> {
		try {
			switch (actionId) {
				case 'new-diary':
					await this.createDiary();
					break;
				case 'deep-research':
					await this.runDeepResearch();
					break;
				case 'pull-rss-feeds':
					await this.refreshExternalFeed('rss');
					break;
				case 'github-feeds':
					await this.refreshExternalFeed('github');
					break;
				case 'inbox-ingest':
					await this.captureInbox();
					break;
				case 'vault-lint':
					await this.createVaultLintReport();
					break;
				default:
					throw new Error(`未知的仪表盘操作：${actionId}`);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : '仪表盘操作失败';
			new Notice(message);
		}
	}

	async openTask(task: ParsedTask): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(
			normalizePath(task.filePath),
		);
		if (!(file instanceof TFile)) {
			new Notice(`任务来源已不存在：${task.filePath}`);
			return;
		}
		await this.vaultActionService.openFile(file);
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.file?.path === file.path) {
			view.editor.setCursor({ line: task.line, ch: 0 });
			view.editor.scrollIntoView(
				{
					from: { line: task.line, ch: 0 },
					to: { line: task.line, ch: 0 },
				},
				true,
			);
		}
	}

	async openDailyNote(day: ActivityDay): Promise<void> {
		if (!day.dailyNotePath) {
			new Notice(`${day.date} 的日记不存在。`);
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(
			normalizePath(day.dailyNotePath),
		);
		if (!(file instanceof TFile)) {
			new Notice(`日记已不存在：${day.dailyNotePath}`);
			await this.refreshDashboard();
			return;
		}

		const existingLeaf = this.app.workspace
			.getLeavesOfType('markdown')
			.find(
				(leaf) =>
					leaf.view instanceof MarkdownView &&
					leaf.view.file?.path === file.path,
			);
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(file);
		await this.app.workspace.revealLeaf(leaf);
	}

	async openPeriodLink(target: PeriodLinkTarget): Promise<void> {
		const labels = {
			week: '每周',
			month: '每月',
			quarter: '季度',
			year: '年度',
		} as const;
		const label = labels[target.kind];
		if (!target.filePath) {
			new Notice(`未找到${label}复盘笔记。`);
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(
			normalizePath(target.filePath),
		);
		if (!(file instanceof TFile)) {
			new Notice(`复盘笔记已不存在：${target.filePath}`);
			await this.refreshDashboard();
			return;
		}

		const existingLeaf = this.app.workspace
			.getLeavesOfType('markdown')
			.find(
				(leaf) =>
					leaf.view instanceof MarkdownView &&
					leaf.view.file?.path === file.path,
			);
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
		} else {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(file);
			await this.app.workspace.revealLeaf(leaf);
		}

		if (target.status === 'fallback') {
			new Notice(
				`未找到本期${label}复盘，已打开 ${target.displayTarget}。`,
			);
		}
	}

	openExternalItem(item: ExternalFeedItem): void {
		try {
			const url = new URL(item.url);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') {
				new Notice('只能打开 HTTP 或 HTTPS 链接。');
				return;
			}
			this.app.workspace.containerEl.ownerDocument.defaultView?.open(
				url.toString(),
				'_blank',
				'noopener,noreferrer',
			);
		} catch {
			new Notice('外部链接无效。');
		}
	}

	cancelAgentTask(): void {
		this.agentTaskService.cancel();
	}

	private async createDiary(): Promise<void> {
		const preview = this.vaultActionService.getDiaryPreview();
		const existing = this.vaultActionService.getExistingFile(preview.path);
		if (existing) {
			await this.vaultActionService.openFile(existing);
			new Notice('今天的日记已存在。');
			return;
		}
		const confirmed = await new ConfirmationModal(this.app, {
			title: '创建今天的日记？',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: '创建日记',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('今天的日记已创建。');
	}

	private async captureInbox(): Promise<void> {
		const input = await new CaptureModal(this.app).openAndWait();
		if (!input) return;
		const preview = this.vaultActionService.getInboxPreview(
			input.title,
			input.content,
		);
		const confirmed = await new ConfirmationModal(this.app, {
			title: '创建 Inbox 笔记？',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: '创建笔记',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('Inbox 笔记已创建。');
	}

	private async createVaultLintReport(): Promise<void> {
		const snapshot = this.dashboardDataService.getState().snapshot;
		if (!snapshot) {
			throw new Error('请先刷新仪表盘，再创建检查报告。');
		}
		const preview = this.vaultActionService.getLintReportPreview(snapshot);
		const confirmed = await new ConfirmationModal(this.app, {
			title: '创建 Vault 检查报告？',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: '创建报告',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		new Notice('Vault 检查报告已创建。');
	}

	private async refreshExternalFeed(source: 'github' | 'rss'): Promise<void> {
		const settings = this.settings;
		const sources =
			source === 'github'
				? [
						...settings.githubRepositories,
						settings.githubSearchQuery
							? `搜索：${settings.githubSearchQuery}`
							: '',
					].filter(Boolean)
				: settings.rssFeeds;
		if (sources.length === 0) {
			throw new Error(`请先配置至少一个 ${source.toUpperCase()} 来源。`);
		}
		const confirmed = await new ConfirmationModal(this.app, {
			title: `刷新 ${source === 'github' ? 'GitHub' : 'RSS'} 信息流？`,
			description:
				'这会向下列公开来源发送网络请求，不包含任何 Vault 内容或凭据。',
			preview: sources.join('\n'),
			confirmLabel: '允许请求',
		}).openAndWait();
		if (!confirmed) return;
		await this.externalFeedService.refresh(source);
		new Notice(`${source === 'github' ? 'GitHub' : 'RSS'} 信息流已刷新。`);
	}

	private async runDeepResearch(): Promise<void> {
		if (!Platform.isDesktop) {
			throw new Error('本地智能体任务仅支持桌面端。');
		}
		const topic = await new TopicModal(this.app).openAndWait();
		if (!topic) return;
		const command = this.agentTaskService.getCommand(topic);
		const confirmed = await new ConfirmationModal(this.app, {
			title: '运行本地研究智能体？',
			description:
				'这会以受限的只读或计划模式启动已配置的本地 CLI。继续前请检查完整命令。',
			preview: command.preview,
			confirmLabel: '运行智能体',
		}).openAndWait();
		if (!confirmed) return;

		const output = await this.agentTaskService.run(topic);
		if (!output.trim()) {
			new Notice('本地智能体已结束，但没有输出。');
			return;
		}
		const preview = this.vaultActionService.getAgentOutputPreview(topic, output);
		const saveConfirmed = await new ConfirmationModal(this.app, {
			title: '保存智能体输出？',
			description: preview.description,
			path: preview.path,
			preview: preview.content.slice(0, 4_000),
			confirmLabel: '保存报告',
		}).openAndWait();
		if (!saveConfirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('智能体输出已保存。');
	}

	private async loadPluginData(): Promise<void> {
		const loaded = (await this.loadData()) as unknown;
		const root = isRecord(loaded) ? loaded : {};
		const settingsSource = isRecord(root.settings) ? root.settings : root;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsSource);
		const periodTemplateSource = isRecord(settingsSource.periodLinkTemplates)
			? settingsSource.periodLinkTemplates
			: {};
		this.settings.periodLinkTemplates = {
			week:
				typeof periodTemplateSource.week === 'string' &&
				periodTemplateSource.week.trim()
					? periodTemplateSource.week.trim()
					: DEFAULT_SETTINGS.periodLinkTemplates.week,
			month:
				typeof periodTemplateSource.month === 'string' &&
				periodTemplateSource.month.trim()
					? periodTemplateSource.month.trim()
					: DEFAULT_SETTINGS.periodLinkTemplates.month,
			quarter:
				typeof periodTemplateSource.quarter === 'string' &&
				periodTemplateSource.quarter.trim()
					? periodTemplateSource.quarter.trim()
					: DEFAULT_SETTINGS.periodLinkTemplates.quarter,
			year:
				typeof periodTemplateSource.year === 'string' &&
				periodTemplateSource.year.trim()
					? periodTemplateSource.year.trim()
					: DEFAULT_SETTINGS.periodLinkTemplates.year,
		};
		this.settings.dailyFolder =
			typeof this.settings.dailyFolder === 'string'
				? normalizePath(this.settings.dailyFolder)
				: DEFAULT_SETTINGS.dailyFolder;
		this.settings.inboxFolder =
			typeof this.settings.inboxFolder === 'string'
				? normalizePath(this.settings.inboxFolder)
				: DEFAULT_SETTINGS.inboxFolder;
		this.settings.reportsFolder =
			typeof this.settings.reportsFolder === 'string'
				? normalizePath(this.settings.reportsFolder)
				: DEFAULT_SETTINGS.reportsFolder;
		this.settings.agentOutputFolder =
			typeof this.settings.agentOutputFolder === 'string'
				? normalizePath(this.settings.agentOutputFolder)
				: DEFAULT_SETTINGS.agentOutputFolder;
		this.settings.agentProvider =
			this.settings.agentProvider === 'claude' ? 'claude' : 'codex';
		this.settings.agentCommand =
			typeof this.settings.agentCommand === 'string' &&
			this.settings.agentCommand.trim()
				? this.settings.agentCommand.trim()
				: this.settings.agentProvider;
		this.settings.githubSearchQuery =
			typeof this.settings.githubSearchQuery === 'string'
				? this.settings.githubSearchQuery
				: DEFAULT_SETTINGS.githubSearchQuery;
		this.settings.githubRepositories = Array.isArray(
			this.settings.githubRepositories,
		)
			? this.settings.githubRepositories.filter(
					(value): value is string => typeof value === 'string',
				)
			: [...DEFAULT_SETTINGS.githubRepositories];
		this.settings.rssFeeds = Array.isArray(this.settings.rssFeeds)
			? this.settings.rssFeeds.filter(
					(value): value is string => typeof value === 'string',
				)
			: [];

		const cacheSource = isRecord(root.externalCache)
			? root.externalCache
			: null;
		this.externalCache = {
			items: Array.isArray(cacheSource?.items)
				? cacheSource.items.filter(isExternalFeedItem)
				: [],
			refreshedAt:
				typeof cacheSource?.refreshedAt === 'number'
					? cacheSource.refreshedAt
					: null,
		};
	}

	private async savePluginData(): Promise<void> {
		const data: StoredPluginData = {
			settings: this.settings,
			externalCache: this.externalCache,
		};
		await this.saveData(data);
	}

	private async activateDashboardView(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_AGENT_DASHBOARD,
		)[0];
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({
			type: VIEW_TYPE_AGENT_DASHBOARD,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}
}
