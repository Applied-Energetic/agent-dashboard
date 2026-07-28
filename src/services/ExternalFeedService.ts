import { requestUrl } from 'obsidian';
import {
	normalizeGitHubPayloads,
	type ExternalFeedItem,
	type ExternalFeedSource,
} from '../domain/externalFeeds';
import type { AgentDashboardSettings } from '../settings';

export interface ExternalFeedCache {
	items: ExternalFeedItem[];
	refreshedAt: number | null;
}

export interface ExternalFeedState extends ExternalFeedCache {
	loadingSource: ExternalFeedSource | null;
	error: string | null;
}

type ExternalFeedListener = (state: ExternalFeedState) => void;

export class ExternalFeedService {
	private readonly listeners = new Set<ExternalFeedListener>();
	private state: ExternalFeedState;

	constructor(
		private readonly getSettings: () => AgentDashboardSettings,
		cache: ExternalFeedCache,
		private readonly getWindow: () => Window | null,
		private readonly saveCache: (cache: ExternalFeedCache) => Promise<void>,
	) {
		this.state = {
			...cache,
			loadingSource: null,
			error: null,
		};
	}

	getState(): ExternalFeedState {
		return this.state;
	}

	subscribe(listener: ExternalFeedListener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	async refresh(source: ExternalFeedSource): Promise<void> {
		this.setState({ ...this.state, loadingSource: source, error: null });

		try {
			const items =
				source === 'github'
					? await this.fetchGitHub()
					: await this.fetchRssFeeds();
			const otherItems = this.state.items.filter(
				(item) => item.source !== source,
			);
			const cache: ExternalFeedCache = {
				items: [...items, ...otherItems]
					.sort(
						(left, right) =>
							Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
					)
					.slice(0, 12),
				refreshedAt: Date.now(),
			};
			await this.saveCache(cache);
			this.setState({
				...cache,
				loadingSource: null,
				error: null,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'External feed refresh failed';
			this.setState({
				...this.state,
				loadingSource: null,
				error: message,
			});
			throw error;
		}
	}

	private async fetchGitHub(): Promise<ExternalFeedItem[]> {
		const settings = this.getSettings();
		const requests = settings.githubRepositories
			.map((repo) => repo.replace(/^\/+|\/+$/gu, ''))
			.filter((repo) => /^[\w.-]+\/[\w.-]+$/u.test(repo))
			.slice(0, 5)
			.map(async (repository) => {
				const response = await requestUrl({
					url: `https://api.github.com/repos/${repository}`,
					headers: {
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
					},
				});
				return response.json as unknown;
			});

		if (settings.githubSearchQuery.length > 0) {
			requests.push(
				requestUrl({
					url:
						'https://api.github.com/search/repositories' +
						`?q=${encodeURIComponent(settings.githubSearchQuery)}` +
						'&sort=updated&order=desc&per_page=5',
					headers: {
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
					},
				}).then((response) => response.json as unknown),
			);
		}

		if (requests.length === 0) return [];
		const results = await Promise.allSettled(requests);
		const payloads = results.flatMap((result): unknown[] =>
			result.status === 'fulfilled' ? [result.value] : [],
		);
		if (payloads.length === 0) {
			throw new Error('All configured GitHub requests failed.');
		}
		return normalizeGitHubPayloads(payloads);
	}

	private async fetchRssFeeds(): Promise<ExternalFeedItem[]> {
		const feeds = this.getSettings().rssFeeds.slice(0, 8);
		const results = await Promise.allSettled(
			feeds.map(async (url) => {
				const response = await requestUrl({ url });
				return this.parseRss(response.text, url);
			}),
		);
		const items = results.flatMap((result) =>
			result.status === 'fulfilled' ? result.value : [],
		);
		if (feeds.length > 0 && items.length === 0) {
			throw new Error('All configured RSS requests failed.');
		}
		return items
			.sort(
				(left, right) =>
					Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
			)
			.slice(0, 8);
	}

	private parseRss(xml: string, sourceUrl: string): ExternalFeedItem[] {
		const viewWindow = this.getWindow();
		if (!viewWindow) {
			throw new Error('The Obsidian window is not available.');
		}
		const WindowDomParser = (
			viewWindow as Window & { DOMParser: typeof DOMParser }
		).DOMParser;
		const document = new WindowDomParser().parseFromString(
			xml,
			'application/xml',
		);
		if (document.querySelector('parsererror')) {
			throw new Error(`Invalid RSS or Atom document: ${sourceUrl}`);
		}

		const feedTitle =
			document.querySelector('channel > title, feed > title')?.textContent?.trim() ??
			new URL(sourceUrl).hostname;
		return Array.from(document.querySelectorAll<Element>('item, entry'))
			.slice(0, 5)
			.flatMap((entry, index): ExternalFeedItem[] => {
				const title = entry.querySelector('title')?.textContent?.trim();
				const rawLink =
					entry.querySelector('link[href]')?.getAttribute('href') ??
					entry.querySelector('link')?.textContent?.trim();
				if (!title || !rawLink) return [];

				const publishedAt =
					entry
						.querySelector('pubDate, published, updated')
						?.textContent?.trim() ?? new Date().toISOString();
				const summary =
					entry
						.querySelector('description, summary, content')
						?.textContent?.replace(/\s+/gu, ' ')
						.trim()
						.slice(0, 180) ?? 'New feed item';
				const parsedUrl = new URL(rawLink, sourceUrl);
				if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
					return [];
				}
				const url = parsedUrl.toString();
				return [
					{
						id: `rss:${url}:${index}`,
						source: 'rss',
						sourceLabel: feedTitle,
						title,
						summary,
						url,
						publishedAt,
						meta: 'RSS',
					},
				];
			});
	}

	private setState(state: ExternalFeedState): void {
		this.state = state;
		for (const listener of this.listeners) listener(state);
	}
}
