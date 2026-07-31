import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	normalizePath,
} from 'obsidian';
import type {
	PeriodLinkKind,
	PeriodLinkTemplates,
} from './domain/dashboard';

export type AgentProvider = 'codex' | 'claude';

export interface AgentDashboardSettings {
	dailyFolder: string;
	inboxFolder: string;
	reportsFolder: string;
	periodLinkTemplates: PeriodLinkTemplates;
	githubRepositories: string[];
	githubSearchQuery: string;
	rssFeeds: string[];
	agentProvider: AgentProvider;
	agentCommand: string;
	agentOutputFolder: string;
}

export const DEFAULT_SETTINGS: AgentDashboardSettings = {
	dailyFolder: 'Daily',
	inboxFolder: 'Inbox',
	reportsFolder: 'Reports',
	periodLinkTemplates: {
		week: '{{YYYY}}-W{{WW}}',
		month: '{{YYYY}}-{{MM}}月计划',
		quarter: '{{YYYY}}-Q{{Q}}',
		year: '{{YYYY}}年度曼陀罗计划',
	},
	githubRepositories: [
		'obsidianmd/obsidian-api',
		'anthropics/skills',
		'openai/codex',
	],
	githubSearchQuery: 'ai agent',
	rssFeeds: [],
	agentProvider: 'codex',
	agentCommand: 'codex',
	agentOutputFolder: 'Reports',
};

export type AgentDashboardSettingsHost = Plugin & {
	settings: AgentDashboardSettings;
	saveSettings(): Promise<void>;
	refreshDashboard(): Promise<void>;
};

function normalizeFolder(value: string, fallback: string): string {
	const trimmed = value.trim().replace(/^\/+|\/+$/gu, '');
	return normalizePath(trimmed || fallback);
}

function parseLines(value: string): string[] {
	return value
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export class AgentDashboardSettingTab extends PluginSettingTab {
	private readonly plugin: AgentDashboardSettingsHost;

	constructor(app: App, plugin: AgentDashboardSettingsHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Vault 路径')
			.setDesc('所有路径均相对于当前 vault，且不会发送到外部。')
			.setHeading();

		this.addFolderSetting(
			containerEl,
			'每日笔记文件夹',
			'用于查找 YYYY-MM-DD.md，并在确认后创建日记。',
			'dailyFolder',
			DEFAULT_SETTINGS.dailyFolder,
		);
		this.addFolderSetting(
			containerEl,
			'Inbox 文件夹',
			'用于统计待处理笔记，并在确认后收集到 Inbox。',
			'inboxFolder',
			DEFAULT_SETTINGS.inboxFolder,
		);
		this.addFolderSetting(
			containerEl,
			'报告文件夹',
			'确认后的 Vault 检查报告将创建在此处。',
			'reportsFolder',
			DEFAULT_SETTINGS.reportsFolder,
		);

		new Setting(containerEl)
			.setName('周期复盘链接')
			.setDesc('使用模板定位当前周期的本地笔记。')
			.setHeading();

		this.addPeriodTemplateSetting(
			containerEl,
			'每周复盘',
			'支持 {{YYYY}} 和 ISO 周数标记 {{WW}}。',
			'week',
		);
		this.addPeriodTemplateSetting(
			containerEl,
			'每月复盘',
			'支持 {{YYYY}} 和月份标记 {{MM}}。',
			'month',
		);
		this.addPeriodTemplateSetting(
			containerEl,
			'季度复盘',
			'支持 {{YYYY}} 和季度标记 {{Q}}。',
			'quarter',
		);
		this.addPeriodTemplateSetting(
			containerEl,
			'年度复盘',
			'支持日历年份标记 {{YYYY}}。',
			'year',
		);

		new Setting(containerEl)
			.setName('外部信息')
			.setDesc('仅在你确认手动刷新后才会访问网络。')
			.setHeading();

		new Setting(containerEl)
			.setName('GitHub 仓库')
			.setDesc('每行填写一个公开的 owner/repository，不存储 token。')
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.githubRepositories[0] ?? '')
					.setValue(this.plugin.settings.githubRepositories.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.githubRepositories = parseLines(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('GitHub 搜索')
			.setDesc('可选的公开仓库搜索，用于补充信息流空位。')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.githubSearchQuery)
					.setValue(this.plugin.settings.githubSearchQuery)
					.onChange(async (value) => {
						this.plugin.settings.githubSearchQuery = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('RSS 订阅源')
			.setDesc('每行填写一个公开订阅源 URL。')
			.addTextArea((text) =>
				text
					.setPlaceholder('https://example.com/feed.xml')
					.setValue(this.plugin.settings.rssFeeds.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.rssFeeds = parseLines(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('本地智能体')
			.setDesc('仅限桌面端；每次运行前都会预览命令。')
			.setHeading();

		new Setting(containerEl)
			.setName('服务提供方')
			.setDesc('选择这台电脑上已安装的本地 CLI。')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('codex', 'Codex CLI')
					.addOption('claude', 'Claude code')
					.setValue(this.plugin.settings.agentProvider)
					.onChange(async (value) => {
						if (value !== 'codex' && value !== 'claude') return;
						this.plugin.settings.agentProvider = value;
						if (
							this.plugin.settings.agentCommand === 'codex' ||
							this.plugin.settings.agentCommand === 'claude'
						) {
							this.plugin.settings.agentCommand = value;
						}
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName('CLI 可执行文件')
			.setDesc('填写可执行文件名或绝对路径，不接受额外 shell 参数。')
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.settings.agentProvider)
					.setValue(this.plugin.settings.agentCommand)
					.onChange(async (value) => {
						this.plugin.settings.agentCommand =
							value.trim() || this.plugin.settings.agentProvider;
						await this.plugin.saveSettings();
					}),
			);

		this.addFolderSetting(
			containerEl,
			'智能体输出文件夹',
			'成功的输出会先预览，确认后才保存到此处。',
			'agentOutputFolder',
			DEFAULT_SETTINGS.agentOutputFolder,
		);

		new Setting(containerEl)
			.setName('刷新本地指标')
			.setDesc('使用以上路径重新扫描当前 vault。')
			.addButton((button) =>
				button.setButtonText('刷新').onClick(async () => {
					await this.plugin.refreshDashboard();
					new Notice('Agent dashboard 指标已刷新。');
				}),
			);
	}

	private addFolderSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		key: 'dailyFolder' | 'inboxFolder' | 'reportsFolder' | 'agentOutputFolder',
		fallback: string,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) =>
				text
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = normalizeFolder(value, fallback);
						await this.plugin.saveSettings();
						await this.plugin.refreshDashboard();
					}),
			);
	}

	private addPeriodTemplateSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		kind: PeriodLinkKind,
	): void {
		const fallback = DEFAULT_SETTINGS.periodLinkTemplates[kind];
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) =>
				text
					.setPlaceholder(fallback)
					.setValue(this.plugin.settings.periodLinkTemplates[kind])
					.onChange(async (value) => {
						this.plugin.settings.periodLinkTemplates[kind] =
							value.trim() || fallback;
						await this.plugin.saveSettings();
						await this.plugin.refreshDashboard();
					}),
			);
	}
}
