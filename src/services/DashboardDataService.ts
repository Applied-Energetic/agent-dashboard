import {
	App,
	Component,
	TFile,
	getAllTags,
	type EventRef,
} from 'obsidian';
import {
	createDashboardSnapshot,
	parseMarkdownTasks,
	type DashboardNoteRecord,
	type DashboardSnapshot,
} from '../domain/dashboard';
import type { AgentDashboardSettings } from '../settings';

export type DashboardLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DashboardDataState {
	status: DashboardLoadStatus;
	snapshot: DashboardSnapshot | null;
	error: string | null;
}

type DashboardListener = (state: DashboardDataState) => void;

export class DashboardDataService extends Component {
	private readonly listeners = new Set<DashboardListener>();
	private refreshTimer: number | null = null;
	private state: DashboardDataState = {
		status: 'idle',
		snapshot: null,
		error: null,
	};

	constructor(
		private readonly app: App,
		private readonly getSettings: () => AgentDashboardSettings,
	) {
		super();
	}

	onload(): void {
		const refreshWhenMarkdownChanges = (file: unknown): void => {
			if (file instanceof TFile && file.extension === 'md') {
				this.scheduleRefresh();
			}
		};

		const events: EventRef[] = [
			this.app.vault.on('create', refreshWhenMarkdownChanges),
			this.app.vault.on('modify', refreshWhenMarkdownChanges),
			this.app.vault.on('delete', refreshWhenMarkdownChanges),
			this.app.vault.on('rename', refreshWhenMarkdownChanges),
			this.app.metadataCache.on('changed', refreshWhenMarkdownChanges),
		];
		for (const event of events) this.registerEvent(event);

		this.register(() => {
			const viewWindow =
				this.app.workspace.containerEl.ownerDocument.defaultView;
			if (this.refreshTimer !== null && viewWindow) {
				viewWindow.clearTimeout(this.refreshTimer);
			}
		});
		void this.refresh();
	}

	getState(): DashboardDataState {
		return this.state;
	}

	subscribe(listener: DashboardListener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	async refresh(): Promise<void> {
		this.setState({ ...this.state, status: 'loading', error: null });

		try {
			const files = this.app.vault.getMarkdownFiles();
			const notes = await Promise.all(
				files.map(async (file): Promise<DashboardNoteRecord> => {
					const cache = this.app.metadataCache.getFileCache(file);
					const containsTasks =
						cache?.listItems?.some((item) => item.task !== undefined) ??
						false;
					const content = containsTasks
						? await this.app.vault.cachedRead(file)
						: '';

					return {
						path: file.path,
						createdAt: file.stat.ctime,
						modifiedAt: file.stat.mtime,
						linkCount:
							(cache?.links?.length ?? 0) +
							(cache?.frontmatterLinks?.length ?? 0),
						tagCount: getAllTags(cache ?? {})?.length ?? 0,
						tasks: parseMarkdownTasks(file.path, content),
					};
				}),
			);
			const settings = this.getSettings();
			const snapshot = createDashboardSnapshot(notes, {
				dailyFolder: settings.dailyFolder,
				inboxFolder: settings.inboxFolder,
			});
			this.setState({ status: 'ready', snapshot, error: null });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown Vault scan error';
			this.setState({ ...this.state, status: 'error', error: message });
		}
	}

	private scheduleRefresh(): void {
		const viewWindow = this.app.workspace.containerEl.ownerDocument.defaultView;
		if (!viewWindow) {
			void this.refresh();
			return;
		}
		if (this.refreshTimer !== null) {
			viewWindow.clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = viewWindow.setTimeout(() => {
			this.refreshTimer = null;
			void this.refresh();
		}, 500);
	}

	private setState(state: DashboardDataState): void {
		this.state = state;
		for (const listener of this.listeners) listener(state);
	}
}
