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
			pathEl.createSpan({ text: 'Target path' });
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
			button.setButtonText('Cancel').onClick(() => {
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
		this.titleEl.setText('Capture to inbox');

		new Setting(this.contentEl)
			.setName('Title')
			.setDesc('Used to create a safe Markdown filename.')
			.addText((text) => {
				text.setPlaceholder('Research note').onChange((value) => {
					this.title = value;
				});
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.setName('Content')
			.setDesc('Plain Markdown content for the new note.')
			.addTextArea((text) =>
				text.setPlaceholder('What should be captured?').onChange((value) => {
					this.content = value;
				}),
			);

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => {
					this.finish(null);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Preview')
					.setCta()
					.onClick(() => {
						const title = this.title.trim();
						const content = this.content.trim();
						if (!title || !content) {
							new Notice('Enter both a title and content.');
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
		this.titleEl.setText('Deep research topic');
		new Setting(this.contentEl)
			.setName('Research brief')
			.setDesc('The local CLI receives this text after a separate confirmation.')
			.addTextArea((text) => {
				text.setPlaceholder('Research a specific topic…').onChange((value) => {
					this.topic = value;
				});
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => {
					this.finish(null);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Preview command')
					.setCta()
					.onClick(() => {
						const topic = this.topic.trim();
						if (!topic) {
							new Notice('Enter a research topic.');
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
