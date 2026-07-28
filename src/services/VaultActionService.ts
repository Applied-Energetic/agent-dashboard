import {
	App,
	TFile,
	TFolder,
	normalizePath,
	type WorkspaceLeaf,
} from 'obsidian';
import {
	buildDiaryContent,
	buildInboxContent,
	sanitizeFileName,
} from '../domain/vaultActions';
import { formatLocalDate, type DashboardSnapshot } from '../domain/dashboard';
import type { AgentDashboardSettings } from '../settings';

export interface VaultWritePreview {
	path: string;
	content: string;
	description: string;
}

export class VaultActionService {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => AgentDashboardSettings,
	) {}

	getDiaryPreview(now: Date = new Date()): VaultWritePreview {
		const date = formatLocalDate(now);
		const path = normalizePath(
			`${this.getSettings().dailyFolder}/${date}.md`,
		);
		return {
			path,
			content: buildDiaryContent(date),
			description: 'Create today’s daily note. Existing files are never overwritten.',
		};
	}

	getInboxPreview(
		title: string,
		content: string,
		now: Date = new Date(),
	): VaultWritePreview {
		const safeTitle = sanitizeFileName(title) || 'Untitled capture';
		const stamp = now.toISOString().replace(/[:.]/gu, '-');
		const path = normalizePath(
			`${this.getSettings().inboxFolder}/${stamp}-${safeTitle}.md`,
		);
		return {
			path,
			content: buildInboxContent(safeTitle, content, now.toISOString()),
			description: 'Create a new Inbox note with local frontmatter.',
		};
	}

	getLintReportPreview(
		snapshot: DashboardSnapshot,
		now: Date = new Date(),
	): VaultWritePreview {
		const date = formatLocalDate(now);
		const path = normalizePath(
			`${this.getSettings().reportsFolder}/vault-lint-${date}.md`,
		);
		const deductions =
			snapshot.health.deductions.length === 0
				? '- No health deductions.'
				: snapshot.health.deductions
						.map((item) => `- ${item.label}: -${item.points}`)
						.join('\n');
		const content = [
			`# Vault lint report — ${date}`,
			'',
			`- Health score: ${snapshot.health.score}`,
			`- Markdown notes: ${snapshot.noteCount}`,
			`- Inbox backlog: ${snapshot.inbox.count}`,
			`- Overdue tasks: ${snapshot.taskFlow.overdue}`,
			'',
			'## Deductions',
			'',
			deductions,
			'',
		].join('\n');
		return {
			path,
			content,
			description: 'Create a Markdown report from the current read-only scan.',
		};
	}

	getAgentOutputPreview(
		topic: string,
		content: string,
		now: Date = new Date(),
	): VaultWritePreview {
		const date = formatLocalDate(now);
		const safeTopic = sanitizeFileName(topic).slice(0, 50) || 'research';
		const path = normalizePath(
			`${this.getSettings().agentOutputFolder}/${date}-${safeTopic}.md`,
		);
		return {
			path,
			content: `# ${topic}\n\n${content.trim()}\n`,
			description: 'Save reviewed local agent output as a Markdown report.',
		};
	}

	async create(preview: VaultWritePreview): Promise<TFile> {
		const existing = this.app.vault.getAbstractFileByPath(preview.path);
		if (existing) {
			throw new Error(`A file already exists at ${preview.path}`);
		}
		await this.ensureParentFolder(preview.path);
		return this.app.vault.create(preview.path, preview.content);
	}

	async openFile(file: TFile): Promise<void> {
		const leaf: WorkspaceLeaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(file);
		await this.app.workspace.revealLeaf(leaf);
	}

	getExistingFile(path: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		return file instanceof TFile ? file : null;
	}

	private async ensureParentFolder(filePath: string): Promise<void> {
		const parentPath = filePath.split('/').slice(0, -1).join('/');
		if (!parentPath) return;

		const segments = parentPath.split('/');
		let current = '';
		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing instanceof TFolder) continue;
			if (existing) {
				throw new Error(`Cannot create folder because ${current} is a file`);
			}
			await this.app.vault.createFolder(current);
		}
	}
}
