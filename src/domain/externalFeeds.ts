export type ExternalFeedSource = 'github' | 'rss';

export interface ExternalFeedItem {
	id: string;
	source: ExternalFeedSource;
	sourceLabel: string;
	title: string;
	summary: string;
	url: string;
	publishedAt: string;
	meta: string;
}

interface GitHubRepository {
	full_name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isGitHubRepository(value: unknown): value is GitHubRepository {
	if (!isRecord(value)) return false;
	return (
		typeof value.full_name === 'string' &&
		(value.description === null || typeof value.description === 'string') &&
		typeof value.html_url === 'string' &&
		typeof value.stargazers_count === 'number' &&
		typeof value.updated_at === 'string'
	);
}

export function normalizeGitHubPayloads(
	payloads: readonly unknown[],
): ExternalFeedItem[] {
	const repositories: GitHubRepository[] = [];
	for (const payload of payloads) {
		if (isGitHubRepository(payload)) {
			repositories.push(payload);
			continue;
		}
		if (!isRecord(payload) || !Array.isArray(payload.items)) continue;
		repositories.push(...payload.items.filter(isGitHubRepository));
	}

	const seen = new Set<string>();
	return repositories
		.filter((repository) => {
			if (seen.has(repository.full_name)) return false;
			seen.add(repository.full_name);
			return true;
		})
		.sort(
			(left, right) =>
				Date.parse(right.updated_at) - Date.parse(left.updated_at),
		)
		.slice(0, 8)
		.map((repository) => ({
			id: `github:${repository.full_name}`,
			source: 'github',
			sourceLabel: 'GitHub',
			title: repository.full_name,
			summary: repository.description ?? 'Public GitHub repository',
			url: repository.html_url,
			publishedAt: repository.updated_at,
			meta: `${repository.stargazers_count.toLocaleString('en-US')} stars`,
		}));
}
