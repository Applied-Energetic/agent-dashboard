import {
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	AgentDashboardSettings,
	AgentDashboardSettingTab,
} from './settings';
import {
	AgentDashboardView,
	VIEW_TYPE_AGENT_DASHBOARD,
} from './views/AgentDashboardView';

export default class AgentDashboardPlugin extends Plugin {
	settings!: AgentDashboardSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_AGENT_DASHBOARD,
			(leaf) => new AgentDashboardView(leaf),
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
			editorCallback: (
				_editor: Editor,
				_context: MarkdownView | MarkdownFileInfo,
			) => {
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

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AgentDashboardSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
