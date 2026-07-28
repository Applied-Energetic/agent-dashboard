import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	normalizePath,
} from 'obsidian';

export type AgentProvider = 'codex' | 'claude';

export interface AgentDashboardSettings {
	dailyFolder: string;
	inboxFolder: string;
	reportsFolder: string;
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
			.setName('Vault paths')
			.setDesc('Paths are relative to the current vault and are never sent outside it.')
			.setHeading();

		this.addFolderSetting(
			containerEl,
			'Daily notes folder',
			'Used to find YYYY-MM-DD.md and create a diary after confirmation.',
			'dailyFolder',
			DEFAULT_SETTINGS.dailyFolder,
		);
		this.addFolderSetting(
			containerEl,
			'Inbox folder',
			'Used for backlog statistics and confirmed inbox capture.',
			'inboxFolder',
			DEFAULT_SETTINGS.inboxFolder,
		);
		this.addFolderSetting(
			containerEl,
			'Reports folder',
			'Confirmed Vault lint reports are created here.',
			'reportsFolder',
			DEFAULT_SETTINGS.reportsFolder,
		);

		new Setting(containerEl)
			.setName('External signals')
			.setDesc('Network access only occurs after you confirm a manual refresh.')
			.setHeading();

		new Setting(containerEl)
			.setName('GitHub repositories')
			.setDesc('One public owner/repository per line. No token is stored.')
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
			.setName('GitHub search')
			.setDesc('Optional public repository search used to fill remaining feed slots.')
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
			.setName('RSS feeds')
			.setDesc('One public feed URL per line.')
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
			.setName('Local agent')
			.setDesc('Desktop only. The command is previewed before every run.')
			.setHeading();

		new Setting(containerEl)
			.setName('Provider')
			.setDesc('Choose the local CLI already installed on this computer.')
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
			.setName('CLI executable')
			.setDesc('Executable name or absolute path. Extra shell arguments are not accepted.')
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
			'Agent output folder',
			'Successful output is previewed first and only saved here after confirmation.',
			'agentOutputFolder',
			DEFAULT_SETTINGS.agentOutputFolder,
		);

		new Setting(containerEl)
			.setName('Refresh local metrics')
			.setDesc('Re-scan the current vault using the paths above.')
			.addButton((button) =>
				button.setButtonText('Refresh').onClick(async () => {
					await this.plugin.refreshDashboard();
					new Notice('Agent dashboard metrics refreshed.');
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
}
