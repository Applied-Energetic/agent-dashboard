import { App, Modal, Notice, Setting } from 'obsidian';

export interface ConfirmationDetails {
	title: string;
	description: string;
	path?: string;
	preview?: string;
	confirmLabel: string;
}

export class ConfirmationModal extends Modal {
	private settled = false;
	private resolveResult: ((result: boolean) => void) | null = null;

	constructor(
		app: App,
		private readonly details: ConfirmationDetails,
	) {
		super(app);
	}

	openAndWait(): Promise<boolean> {
		this.open();
		return new Promise((resolve) => {
			this.resolveResult = resolve;
		});
	}

	onOpen(): void {
		this.titleEl.setText(this.details.title);
		this.contentEl.createEl('p', {
			cls: 'agent-dashboard-modal__description',
			text: this.details.description,
		});
		if (this.details.path) {
			const pathEl = this.contentEl.createDiv({
				cls: 'agent-dashboard-modal__path',
			});
			pathEl.createSpan({ text: '目标路径' });
			pathEl.createEl('code', { text: this.details.path });
		}
		if (this.details.preview) {
			this.contentEl.createEl('pre', {
				cls: 'agent-dashboard-modal__preview',
				text: this.details.preview,
			});
		}

		const actions = new Setting(this.contentEl);
		actions.addButton((button) => {
			button.setButtonText('取消').onClick(() => {
				this.finish(false);
			});
			button.buttonEl.focus();
		});
		actions.addButton((button) => {
			button
				.setButtonText(this.details.confirmLabel)
				.setCta()
				.onClick(() => {
					this.finish(true);
				});
		});
	}

	onClose(): void {
		if (!this.settled) this.finish(false);
		this.contentEl.empty();
	}

	private finish(result: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult?.(result);
		this.close();
	}
}

export interface CaptureInput {
	title: string;
	content: string;
}

export class CaptureModal extends Modal {
	private settled = false;
	private resolveResult: ((result: CaptureInput | null) => void) | null = null;
	private title = '';
	private content = '';

	openAndWait(): Promise<CaptureInput | null> {
		this.open();
		return new Promise((resolve) => {
			this.resolveResult = resolve;
		});
	}

	onOpen(): void {
		this.titleEl.setText('收集到 inbox');

		new Setting(this.contentEl)
			.setName('标题')
			.setDesc('用于生成安全的 Markdown 文件名。')
			.addText((text) => {
				text.setPlaceholder('研究笔记').onChange((value) => {
					this.title = value;
				});
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.setName('内容')
			.setDesc('新笔记的纯 Markdown 内容。')
			.addTextArea((text) =>
				text.setPlaceholder('需要收集什么内容？').onChange((value) => {
					this.content = value;
				}),
			);

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('取消').onClick(() => {
					this.finish(null);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('预览')
					.setCta()
					.onClick(() => {
						const title = this.title.trim();
						const content = this.content.trim();
						if (!title || !content) {
							new Notice('请输入标题和内容。');
							return;
						}
						this.finish({ title, content });
					}),
			);
	}

	onClose(): void {
		if (!this.settled) this.finish(null);
		this.contentEl.empty();
	}

	private finish(result: CaptureInput | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult?.(result);
		this.close();
	}
}

export class TopicModal extends Modal {
	private settled = false;
	private resolveResult: ((result: string | null) => void) | null = null;
	private topic = '';

	openAndWait(): Promise<string | null> {
		this.open();
		return new Promise((resolve) => {
			this.resolveResult = resolve;
		});
	}

	onOpen(): void {
		this.titleEl.setText('深度研究主题');
		new Setting(this.contentEl)
			.setName('研究任务')
			.setDesc('单独确认后，本地 CLI 才会接收这段文字。')
			.addTextArea((text) => {
				text.setPlaceholder('输入一个具体研究主题…').onChange((value) => {
					this.topic = value;
				});
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('取消').onClick(() => {
					this.finish(null);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('预览命令')
					.setCta()
					.onClick(() => {
						const topic = this.topic.trim();
						if (!topic) {
							new Notice('请输入研究主题。');
							return;
						}
						this.finish(topic);
					}),
			);
	}

	onClose(): void {
		if (!this.settled) this.finish(null);
		this.contentEl.empty();
	}

	private finish(result: string | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult?.(result);
		this.close();
	}
}
