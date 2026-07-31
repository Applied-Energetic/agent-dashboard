import type { AgentProvider } from '../settings';

export interface AgentCommand {
	command: string;
	args: string[];
	preview: string;
}

function quotePreview(value: string): string {
	return /\s/u.test(value) ? `"${value.replace(/"/gu, '\\"')}"` : value;
}

export function buildAgentCommand(
	provider: AgentProvider,
	command: string,
	topic: string,
): AgentCommand {
	const prompt = [
		`Research this topic: ${topic}`,
		'Return a concise Markdown report with a summary, key findings, sources, and next actions.',
		'Do not modify files or execute additional commands.',
	].join('\n');
	const args =
		provider === 'codex'
			? [
					'exec',
					'--sandbox',
					'read-only',
					'--skip-git-repo-check',
					prompt,
				]
			: ['-p', prompt, '--permission-mode', 'plan'];

	return {
		command,
		args,
		preview: [command, ...args].map(quotePreview).join(' '),
	};
}
