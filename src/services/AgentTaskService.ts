import { Platform } from 'obsidian';
import { buildAgentCommand, type AgentCommand } from '../domain/agentTasks';
import type { AgentDashboardSettings } from '../settings';

export type AgentTaskStatus =
	| 'idle'
	| 'running'
	| 'succeeded'
	| 'failed'
	| 'cancelled';

export interface AgentTaskState {
	status: AgentTaskStatus;
	topic: string | null;
	command: AgentCommand | null;
	output: string;
	error: string | null;
	startedAt: number | null;
	finishedAt: number | null;
}

interface RunningChild {
	kill(): boolean;
}

type AgentTaskListener = (state: AgentTaskState) => void;

const INITIAL_STATE: AgentTaskState = {
	status: 'idle',
	topic: null,
	command: null,
	output: '',
	error: null,
	startedAt: null,
	finishedAt: null,
};

export class AgentTaskService {
	private readonly listeners = new Set<AgentTaskListener>();
	private state: AgentTaskState = INITIAL_STATE;
	private child: RunningChild | null = null;
	private cancelRequested = false;

	constructor(
		private readonly getSettings: () => AgentDashboardSettings,
		private readonly getWindow: () => Window | null,
	) {}

	getState(): AgentTaskState {
		return this.state;
	}

	subscribe(listener: AgentTaskListener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	getCommand(topic: string): AgentCommand {
		const settings = this.getSettings();
		return buildAgentCommand(
			settings.agentProvider,
			settings.agentCommand,
			topic,
		);
	}

	async run(topic: string): Promise<string> {
		if (!Platform.isDesktop) {
			throw new Error('Local agent tasks are available on desktop only.');
		}
		if (this.state.status === 'running') {
			throw new Error('An agent task is already running.');
		}

		const command = this.getCommand(topic);
		this.cancelRequested = false;
		this.setState({
			status: 'running',
			topic,
			command,
			output: '',
			error: null,
			startedAt: Date.now(),
			finishedAt: null,
		});

		const { spawn } = await import('node:child_process');
		return new Promise<string>((resolve, reject) => {
			const viewWindow = this.getWindow();
			if (!viewWindow) {
				reject(new Error('The Obsidian window is not available.'));
				return;
			}
			const executable = Platform.isWin ? 'powershell.exe' : command.command;
			const args = Platform.isWin
				? [
						'-NoProfile',
						'-NonInteractive',
						'-ExecutionPolicy',
						'Bypass',
						'-Command',
						'$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new(); & $args[0] @($args[1..($args.Count - 1)])',
						command.command,
						...command.args,
					]
				: command.args;
			const child = spawn(executable, args, {
				shell: false,
				windowsHide: true,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			this.child = child;
			let output = '';
			let settled = false;
			const timeout = viewWindow.setTimeout(
				() => {
					if (settled) return;
					child.kill();
					this.finishWithError('The local agent timed out after 10 minutes.');
				},
				10 * 60 * 1000,
			);

			const appendOutput = (chunk: Uint8Array): void => {
				output = `${output}${new TextDecoder().decode(chunk)}`.slice(-50_000);
				this.setState({ ...this.state, output });
			};
			child.stdout.on('data', appendOutput);
			child.stderr.on('data', appendOutput);
			child.on('error', (error: Error) => {
				if (settled) return;
				settled = true;
				viewWindow.clearTimeout(timeout);
				this.child = null;
				this.finishWithError(error.message);
				reject(error);
			});
			child.on('close', (code: number | null) => {
				if (settled) return;
				settled = true;
				viewWindow.clearTimeout(timeout);
				this.child = null;
				if (this.cancelRequested) {
					this.setState({
						...this.state,
						status: 'cancelled',
						error: null,
						finishedAt: Date.now(),
					});
					reject(new Error('Local agent task cancelled.'));
					return;
				}
				if (code === 0) {
					this.setState({
						...this.state,
						status: 'succeeded',
						output,
						finishedAt: Date.now(),
					});
					resolve(output);
					return;
				}
				const message = `Local agent exited with code ${code ?? 'unknown'}.`;
				this.finishWithError(message);
				reject(new Error(message));
			});
		});
	}

	cancel(): void {
		if (!this.child || this.state.status !== 'running') return;
		this.cancelRequested = true;
		this.child.kill();
		this.setState({
			...this.state,
			status: 'cancelled',
			error: null,
			finishedAt: Date.now(),
		});
	}

	dispose(): void {
		this.cancel();
		this.listeners.clear();
	}

	private finishWithError(message: string): void {
		this.setState({
			...this.state,
			status: 'failed',
			error: message,
			finishedAt: Date.now(),
		});
	}

	private setState(state: AgentTaskState): void {
		this.state = state;
		for (const listener of this.listeners) listener(state);
	}
}
