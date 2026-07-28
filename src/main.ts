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
import type { ParsedTask } from './domain/dashboard';
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

		this.addRibbonIcon('layout-dashboard', 'Open agent dashboard', () => {
			void this.activateDashboardView();
		});

		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open dashboard',
			callback: () => {
				void this.activateDashboardView();
			},
		});

		this.addCommand({
			id: 'replace-selected',
			name: 'Open dashboard from editor',
			editorCallback: () => {
				void this.activateDashboardView();
			},
		});

		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open dashboard with an active note',
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
					throw new Error(`Unknown dashboard action: ${actionId}`);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Dashboard action failed';
			new Notice(message);
		}
	}

	async openTask(task: ParsedTask): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(
			normalizePath(task.filePath),
		);
		if (!(file instanceof TFile)) {
			new Notice(`Task source no longer exists: ${task.filePath}`);
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

	openExternalItem(item: ExternalFeedItem): void {
		try {
			const url = new URL(item.url);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') {
				new Notice('Only HTTP and HTTPS links can be opened.');
				return;
			}
			this.app.workspace.containerEl.ownerDocument.defaultView?.open(
				url.toString(),
				'_blank',
				'noopener,noreferrer',
			);
		} catch {
			new Notice('The external link is invalid.');
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
			new Notice('Today’s diary already exists.');
			return;
		}
		const confirmed = await new ConfirmationModal(this.app, {
			title: 'Create today’s diary?',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: 'Create diary',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('Today’s diary created.');
	}

	private async captureInbox(): Promise<void> {
		const input = await new CaptureModal(this.app).openAndWait();
		if (!input) return;
		const preview = this.vaultActionService.getInboxPreview(
			input.title,
			input.content,
		);
		const confirmed = await new ConfirmationModal(this.app, {
			title: 'Create Inbox note?',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: 'Create note',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('Inbox note created.');
	}

	private async createVaultLintReport(): Promise<void> {
		const snapshot = this.dashboardDataService.getState().snapshot;
		if (!snapshot) {
			throw new Error('Refresh the Dashboard before creating a lint report.');
		}
		const preview = this.vaultActionService.getLintReportPreview(snapshot);
		const confirmed = await new ConfirmationModal(this.app, {
			title: 'Create Vault lint report?',
			description: preview.description,
			path: preview.path,
			preview: preview.content,
			confirmLabel: 'Create report',
		}).openAndWait();
		if (!confirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		new Notice('Vault lint report created.');
	}

	private async refreshExternalFeed(source: 'github' | 'rss'): Promise<void> {
		const settings = this.settings;
		const sources =
			source === 'github'
				? [
						...settings.githubRepositories,
						settings.githubSearchQuery
							? `Search: ${settings.githubSearchQuery}`
							: '',
					].filter(Boolean)
				: settings.rssFeeds;
		if (sources.length === 0) {
			throw new Error(`Configure at least one ${source.toUpperCase()} source first.`);
		}
		const confirmed = await new ConfirmationModal(this.app, {
			title: `Refresh ${source === 'github' ? 'GitHub' : 'RSS'} feed?`,
			description:
				'This sends a network request to the public sources listed below. No Vault content or credentials are included.',
			preview: sources.join('\n'),
			confirmLabel: 'Allow request',
		}).openAndWait();
		if (!confirmed) return;
		await this.externalFeedService.refresh(source);
		new Notice(`${source === 'github' ? 'GitHub' : 'RSS'} feed refreshed.`);
	}

	private async runDeepResearch(): Promise<void> {
		if (!Platform.isDesktop) {
			throw new Error('Local agent tasks are available on desktop only.');
		}
		const topic = await new TopicModal(this.app).openAndWait();
		if (!topic) return;
		const command = this.agentTaskService.getCommand(topic);
		const confirmed = await new ConfirmationModal(this.app, {
			title: 'Run local research agent?',
			description:
				'This starts the configured local CLI in a restricted read-only or plan mode. Review the exact command before continuing.',
			preview: command.preview,
			confirmLabel: 'Run agent',
		}).openAndWait();
		if (!confirmed) return;

		const output = await this.agentTaskService.run(topic);
		if (!output.trim()) {
			new Notice('The local agent finished without output.');
			return;
		}
		const preview = this.vaultActionService.getAgentOutputPreview(topic, output);
		const saveConfirmed = await new ConfirmationModal(this.app, {
			title: 'Save agent output?',
			description: preview.description,
			path: preview.path,
			preview: preview.content.slice(0, 4_000),
			confirmLabel: 'Save report',
		}).openAndWait();
		if (!saveConfirmed) return;
		const file = await this.vaultActionService.create(preview);
		await this.vaultActionService.openFile(file);
		await this.refreshDashboard();
		new Notice('Agent output saved.');
	}

	private async loadPluginData(): Promise<void> {
		const loaded = (await this.loadData()) as unknown;
		const root = isRecord(loaded) ? loaded : {};
		const settingsSource = isRecord(root.settings) ? root.settings : root;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsSource);
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
