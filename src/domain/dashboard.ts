export interface ParsedTask {
	filePath: string;
	line: number;
	title: string;
	done: boolean;
	dueDate?: string;
}

export interface ActivityDay {
	date: string;
	count: number;
	dailyNotePath: string | null;
}

export interface HeatmapMonthLabel {
	label: string;
	column: number;
}

export interface HeatmapLayout {
	cells: Array<ActivityDay | null>;
	months: HeatmapMonthLabel[];
}

export interface NoteCreatedAtInput {
	path: string;
	ctime: number;
	frontmatterCreated?: unknown;
}

export interface DashboardFolderDiagnostic {
	configuredPath: string;
	exists: boolean;
	candidates: string[];
}

export interface DashboardPathDiagnostics {
	daily: DashboardFolderDiagnostic;
	inbox: DashboardFolderDiagnostic;
}

export type PeriodLinkKind = 'week' | 'month' | 'quarter' | 'year';

export interface PeriodLinkTemplates {
	week: string;
	month: string;
	quarter: string;
	year: string;
}

export interface PeriodLinkTarget {
	kind: PeriodLinkKind;
	expectedLinkpath: string;
	displayTarget: string;
	filePath: string | null;
	status: 'current' | 'fallback' | 'missing';
}

export type ResolvedPeriodPaths = Partial<
	Record<PeriodLinkKind, string>
>;

export interface TaskFlow {
	completed: number;
	overdue: number;
	rate: number;
	total: number;
}

export interface HealthInputs {
	activeDaysLast30: number;
	inboxCount: number;
	orphanRatio: number;
	overdueTasks: number;
}

export interface HealthDeduction {
	id: 'inbox' | 'activity' | 'orphans' | 'overdue';
	label: string;
	points: number;
}

export interface HealthScore {
	score: number;
	deductions: HealthDeduction[];
}

export interface DashboardNoteRecord {
	path: string;
	createdAt: number;
	modifiedAt: number;
	linkCount: number;
	tagCount: number;
	tasks: ParsedTask[];
}

export interface DashboardPathSettings {
	dailyFolder: string;
	inboxFolder: string;
}

export interface DashboardTask extends ParsedTask {
	status: 'done' | 'overdue' | 'todo';
}

export interface DashboardSnapshot {
	generatedAt: number;
	noteCount: number;
	activity: ActivityDay[];
	activeNoteDays: number;
	paths: DashboardPathDiagnostics;
	periodLinks: PeriodLinkTarget[];
	inbox: {
		count: number;
		oldestDays: number;
	};
	tasks: DashboardTask[];
	taskFlow: TaskFlow;
	health: HealthScore;
}

const TASK_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/u;
const FILE_DATE_PATTERN =
	/(?:^|[/_\s-])(\d{4}-\d{2}-\d{2})(?=$|[./_\s-])/u;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DAILY_NOTE_FILENAME_PATTERN =
	/(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/u;
const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;
const PERIOD_LINK_KINDS: readonly PeriodLinkKind[] = [
	'week',
	'month',
	'quarter',
	'year',
];
const PERIOD_TOKEN_PATTERN = /\{\{(YYYY|MM|WW|Q)\}\}/gu;

function cleanTaskTitle(source: string): string {
	return source
		.replace(/\[\[([^\]]+)\]\]/gu, (_match, target: string) => {
			const parts = target.split('|');
			return parts.at(-1) ?? target;
		})
		.replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
		.replace(/[*_~`]+/gu, '')
		.replace(/#(?=[\p{L}\p{N}])/gu, '')
		.replace(/\s+/gu, ' ')
		.trim();
}

function parseCreatedAtCandidate(
	value: unknown,
	latestAllowed: number,
): number | null {
	let timestamp = Number.NaN;
	if (value instanceof Date) {
		timestamp = value.getTime();
	} else if (typeof value === 'number') {
		timestamp = value;
	} else if (typeof value === 'string' && value.trim().length > 0) {
		const source = value.trim();
		timestamp = DATE_ONLY_PATTERN.test(source)
			? new Date(`${source}T12:00:00`).getTime()
			: Date.parse(source);
	}

	return Number.isFinite(timestamp) && timestamp <= latestAllowed
		? timestamp
		: null;
}
const DUE_DATE_PATTERN = /\s*📅\s*(\d{4}-\d{2}-\d{2})\s*/u;

export function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function parseMarkdownTasks(filePath: string, content: string): ParsedTask[] {
	const tasks: ParsedTask[] = [];

	for (const [line, source] of content.split(/\r?\n/u).entries()) {
		const match = TASK_PATTERN.exec(source);
		if (!match) continue;

		const rawTitle = match[2] ?? '';
		const dueMatch = DUE_DATE_PATTERN.exec(rawTitle);
		const title = cleanTaskTitle(rawTitle.replace(DUE_DATE_PATTERN, ' '));
		const task: ParsedTask = {
			filePath,
			line,
			title,
			done: (match[1] ?? ' ') !== ' ',
		};
		const dueDate = dueMatch?.[1];
		if (dueDate) task.dueDate = dueDate;
		tasks.push(task);
	}

	return tasks;
}

export function resolveNoteCreatedAt(
	input: NoteCreatedAtInput,
	today: Date = new Date(),
): number {
	const latestAllowed = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() + 1,
	).getTime() - 1;
	const frontmatterDate = parseCreatedAtCandidate(
		input.frontmatterCreated,
		latestAllowed,
	);
	if (frontmatterDate !== null) return frontmatterDate;

	const fileDate = FILE_DATE_PATTERN.exec(input.path)?.[1];
	const filenameDate = parseCreatedAtCandidate(fileDate, latestAllowed);
	return filenameDate ?? input.ctime;
}

export function buildActivityDays(
	notes: readonly { createdAt: number; path?: string }[],
	today: Date = new Date(),
	dailyFolders: readonly string[] = [],
): ActivityDay[] {
	const counts = new Map<string, number>();
	const normalizedDailyFolders = dailyFolders
		.map(normalizeFolderPath)
		.filter((folder) => folder.length > 0);
	const dailyNotePaths = new Map<string, string>();
	for (const note of notes) {
		const key = formatLocalDate(new Date(note.createdAt));
		counts.set(key, (counts.get(key) ?? 0) + 1);

		if (!note.path) continue;
		const normalizedPath = note.path.replaceAll('\\', '/').replace(/^\/+/u, '');
		const dailyDate = DAILY_NOTE_FILENAME_PATTERN.exec(normalizedPath)?.[1];
		if (
			!dailyDate ||
			!normalizedDailyFolders.some((folder) =>
				isPathInsideFolder(normalizedPath, folder),
			)
		) {
			continue;
		}
		const currentPath = dailyNotePaths.get(dailyDate);
		if (!currentPath || normalizedPath.localeCompare(currentPath) < 0) {
			dailyNotePaths.set(dailyDate, normalizedPath);
		}
	}

	const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	cursor.setDate(cursor.getDate() - 364);

	return Array.from({ length: 365 }, () => {
		const date = formatLocalDate(cursor);
		const day = {
			date,
			count: counts.get(date) ?? 0,
			dailyNotePath: dailyNotePaths.get(date) ?? null,
		};
		cursor.setDate(cursor.getDate() + 1);
		return day;
	});
}

export function buildHeatmapLayout(
	activity: readonly ActivityDay[],
): HeatmapLayout {
	if (activity.length === 0) return { cells: [], months: [] };

	const firstDate = new Date(`${activity[0]?.date ?? ''}T12:00:00`);
	const leadingCells = Number.isNaN(firstDate.getTime())
		? 0
		: firstDate.getDay();
	const cells: Array<ActivityDay | null> = [
		...Array.from({ length: leadingCells }, () => null),
		...activity,
	];
	const totalCells = Math.ceil(cells.length / 7) * 7;
	while (cells.length < totalCells) cells.push(null);

	const months: HeatmapMonthLabel[] = [];
	let previousMonth = -1;
	for (const [activityIndex, day] of activity.entries()) {
		const date = new Date(`${day.date}T12:00:00`);
		const month = date.getMonth();
		if (month === previousMonth || Number.isNaN(date.getTime())) continue;
		months.push({
			label: MONTH_LABELS[month] ?? '',
			column: Math.floor((leadingCells + activityIndex) / 7),
		});
		previousMonth = month;
	}

	return { cells, months };
}

function normalizeFolderPath(path: string): string {
	return path.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '');
}

function diagnoseFolder(
	configuredPath: string,
	folderPaths: readonly string[],
	tokens: readonly string[],
): DashboardFolderDiagnostic {
	const normalizedConfiguredPath = normalizeFolderPath(configuredPath);
	const normalizedFolders = folderPaths.map(normalizeFolderPath);
	const candidates = normalizedFolders
		.filter((path) => {
			const folderName = path.split('/').at(-1)?.toLocaleLowerCase() ?? '';
			return tokens.some((token) => folderName.includes(token));
		})
		.filter((path) => path !== normalizedConfiguredPath)
		.sort(
			(left, right) =>
				left.split('/').length - right.split('/').length ||
				left.localeCompare(right),
		)
		.slice(0, 3);

	return {
		configuredPath: normalizedConfiguredPath,
		exists: normalizedFolders.includes(normalizedConfiguredPath),
		candidates,
	};
}

export function diagnoseDashboardFolders(
	settings: DashboardPathSettings,
	folderPaths: readonly string[],
): DashboardPathDiagnostics {
	return {
		daily: diagnoseFolder(settings.dailyFolder, folderPaths, [
			'daily',
			'diary',
			'journal',
			'日记',
			'日志',
		]),
		inbox: diagnoseFolder(settings.inboxFolder, folderPaths, [
			'inbox',
			'收集',
			'收件',
		]),
	};
}

function getIsoWeekParts(date: Date): { week: number; year: number } {
	const cursor = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	);
	const weekday = cursor.getUTCDay() || 7;
	cursor.setUTCDate(cursor.getUTCDate() + 4 - weekday);
	const year = cursor.getUTCFullYear();
	const yearStart = new Date(Date.UTC(year, 0, 1));
	const week = Math.ceil(
		((cursor.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) /
			7,
	);
	return { week, year };
}

function renderPeriodTemplate(
	template: string,
	values: Record<'YYYY' | 'MM' | 'WW' | 'Q', string>,
): string {
	return template.replace(
		PERIOD_TOKEN_PATTERN,
		(_match, token: keyof typeof values) => values[token],
	);
}

export function buildPeriodLinkpaths(
	templates: PeriodLinkTemplates,
	today: Date = new Date(),
): Record<PeriodLinkKind, string> {
	const isoWeek = getIsoWeekParts(today);
	const calendarYear = String(today.getFullYear());
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const quarter = String(Math.floor(today.getMonth() / 3) + 1);
	const week = String(isoWeek.week).padStart(2, '0');

	return {
		week: renderPeriodTemplate(templates.week, {
			YYYY: String(isoWeek.year),
			MM: month,
			WW: week,
			Q: quarter,
		}),
		month: renderPeriodTemplate(templates.month, {
			YYYY: calendarYear,
			MM: month,
			WW: week,
			Q: quarter,
		}),
		quarter: renderPeriodTemplate(templates.quarter, {
			YYYY: calendarYear,
			MM: month,
			WW: week,
			Q: quarter,
		}),
		year: renderPeriodTemplate(templates.year, {
			YYYY: calendarYear,
			MM: month,
			WW: week,
			Q: quarter,
		}),
	};
}

function normalizeMarkdownLinkpath(path: string): string {
	return path
		.trim()
		.replaceAll('\\', '/')
		.replace(/^\/+|\/+$/gu, '')
		.replace(/\.md$/u, '');
}

function getLinkpathSource(path: string, template: string): string {
	const normalized = normalizeMarkdownLinkpath(path);
	return template.includes('/') ? normalized : normalized.split('/').at(-1) ?? '';
}

function compilePeriodTemplate(template: string): RegExp {
	const seenTokens = new Set<string>();
	let pattern = '^';
	let cursor = 0;

	for (const match of template.matchAll(PERIOD_TOKEN_PATTERN)) {
		const index = match.index ?? cursor;
		pattern += template
			.slice(cursor, index)
			.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
		const token = match[1] ?? '';
		if (seenTokens.has(token)) {
			pattern += `\\k<${token}>`;
		} else {
			const tokenPattern =
				token === 'YYYY'
					? '\\d{4}'
					: token === 'Q'
						? '[1-4]'
						: '\\d{2}';
			pattern += `(?<${token}>${tokenPattern})`;
			seenTokens.add(token);
		}
		cursor = index + match[0].length;
	}

	pattern += template
		.slice(cursor)
		.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`${pattern}$`, 'u');
}

function getPeriodKey(
	kind: PeriodLinkKind,
	groups: Record<string, string> | undefined,
): number {
	const year = Number(groups?.YYYY ?? 0);
	switch (kind) {
		case 'week':
			return year * 100 + Number(groups?.WW ?? 0);
		case 'month':
			return year * 100 + Number(groups?.MM ?? 0);
		case 'quarter':
			return year * 10 + Number(groups?.Q ?? 0);
		case 'year':
			return year;
	}
}

function getDisplayTarget(path: string): string {
	return normalizeMarkdownLinkpath(path).split('/').at(-1) ?? path;
}

export function buildPeriodLinkTargets(
	notes: readonly Pick<DashboardNoteRecord, 'path'>[],
	templates: PeriodLinkTemplates,
	today: Date = new Date(),
	resolvedCurrentPaths: ResolvedPeriodPaths = {},
): PeriodLinkTarget[] {
	const linkpaths = buildPeriodLinkpaths(templates, today);

	return PERIOD_LINK_KINDS.map((kind) => {
		const expectedLinkpath = linkpaths[kind];
		const currentPath =
			resolvedCurrentPaths[kind] ??
			notes.find((note) => {
				const source = getLinkpathSource(note.path, templates[kind]);
				return source === normalizeMarkdownLinkpath(expectedLinkpath);
			})?.path;
		if (currentPath) {
			return {
				kind,
				expectedLinkpath,
				displayTarget: getDisplayTarget(currentPath),
				filePath: currentPath,
				status: 'current',
			};
		}

		const templatePattern = compilePeriodTemplate(templates[kind]);
		const expectedMatch = templatePattern.exec(expectedLinkpath);
		const expectedKey = getPeriodKey(kind, expectedMatch?.groups);
		const fallback = notes
			.map((note) => {
				const source = getLinkpathSource(note.path, templates[kind]);
				const match = templatePattern.exec(source);
				return {
					key: getPeriodKey(kind, match?.groups),
					matches: match !== null,
					path: note.path,
				};
			})
			.filter(
				(candidate) =>
					candidate.matches &&
					candidate.key > 0 &&
					candidate.key <= expectedKey,
			)
			.sort(
				(left, right) =>
					right.key - left.key || left.path.localeCompare(right.path),
			)[0];

		return {
			kind,
			expectedLinkpath,
			displayTarget: fallback
				? getDisplayTarget(fallback.path)
				: getDisplayTarget(expectedLinkpath),
			filePath: fallback?.path ?? null,
			status: fallback ? 'fallback' : 'missing',
		};
	});
}

export function calculateTaskFlow(
	tasks: readonly ParsedTask[],
	today: string,
): TaskFlow {
	const relevant = tasks.filter(
		(task) => task.dueDate !== undefined && task.dueDate <= today,
	);
	const completed = relevant.filter((task) => task.done).length;
	const overdue = relevant.filter(
		(task) => !task.done && task.dueDate !== undefined && task.dueDate < today,
	).length;
	const total = relevant.length;

	return {
		completed,
		overdue,
		rate: total === 0 ? 100 : Math.round((completed / total) * 100),
		total,
	};
}

export function calculateHealthScore(inputs: HealthInputs): HealthScore {
	const candidates: HealthDeduction[] = [
		{
			id: 'inbox',
			label: 'Inbox backlog',
			points: Math.min(25, inputs.inboxCount),
		},
		{
			id: 'activity',
			label: 'Low recent activity',
			points: Math.min(16, Math.max(0, 8 - inputs.activeDaysLast30) * 2),
		},
		{
			id: 'orphans',
			label: 'Notes without links or tags',
			points: Math.min(25, Math.round(inputs.orphanRatio * 25)),
		},
		{
			id: 'overdue',
			label: 'Overdue tasks',
			points: Math.min(20, inputs.overdueTasks * 4),
		},
	];
	const deductions = candidates.filter((deduction) => deduction.points > 0);

	const totalDeductions = deductions.reduce(
		(total, deduction) => total + deduction.points,
		0,
	);

	return {
		score: Math.max(0, 100 - totalDeductions),
		deductions,
	};
}

function isPathInsideFolder(path: string, folder: string): boolean {
	const normalizedFolder = folder.replace(/^\/+|\/+$/gu, '');
	return normalizedFolder.length > 0 && path.startsWith(`${normalizedFolder}/`);
}

export function createDashboardSnapshot(
	notes: readonly DashboardNoteRecord[],
	settings: DashboardPathSettings,
	todayDate: Date = new Date(),
	folderPaths: readonly string[] = [],
	periodLinks: readonly PeriodLinkTarget[] = [],
): DashboardSnapshot {
	const today = formatLocalDate(todayDate);
	const todayPath = `${settings.dailyFolder.replace(/\/+$/u, '')}/${today}.md`;
	const allTasks = notes.flatMap((note) => note.tasks);
	const dashboardTasks = allTasks
		.filter(
			(task) =>
				task.filePath === todayPath ||
				(task.dueDate !== undefined && task.dueDate <= today),
		)
		.map<DashboardTask>((task) => ({
			...task,
			status: task.done
				? 'done'
				: task.dueDate !== undefined && task.dueDate < today
					? 'overdue'
					: 'todo',
		}))
		.sort((left, right) => {
			const rank = { overdue: 0, todo: 1, done: 2 };
			return (
				rank[left.status] - rank[right.status] ||
				(left.dueDate ?? today).localeCompare(right.dueDate ?? today) ||
				left.filePath.localeCompare(right.filePath) ||
				left.line - right.line
			);
		});

	const flowTasks = dashboardTasks.map((task) => ({
		...task,
		dueDate: task.dueDate ?? today,
	}));
	const taskFlow = calculateTaskFlow(flowTasks, today);
	const paths = diagnoseDashboardFolders(settings, folderPaths);
	const dailyFolders = paths.daily.exists
		? [paths.daily.configuredPath]
		: paths.daily.candidates.slice(0, 1);
	const activity = buildActivityDays(notes, todayDate, dailyFolders);
	const inboxNotes = notes.filter((note) =>
		isPathInsideFolder(note.path, settings.inboxFolder),
	);
	const todayStart = new Date(
		todayDate.getFullYear(),
		todayDate.getMonth(),
		todayDate.getDate(),
	).getTime();
	const oldestInboxCreatedAt = Math.min(
		...inboxNotes.map((note) => note.createdAt),
		todayStart,
	);
	const orphanCount = notes.filter(
		(note) => note.linkCount === 0 && note.tagCount === 0,
	).length;
	const activeDaysLast30 = activity
		.slice(-30)
		.filter((day) => day.count > 0).length;
	const health = calculateHealthScore({
		activeDaysLast30,
		inboxCount: inboxNotes.length,
		orphanRatio: notes.length === 0 ? 0 : orphanCount / notes.length,
		overdueTasks: taskFlow.overdue,
	});
	const todayDayNumber = Math.floor(
		Date.UTC(
			todayDate.getFullYear(),
			todayDate.getMonth(),
			todayDate.getDate(),
		) /
			(24 * 60 * 60 * 1000),
	);
	const oldestInboxDate = new Date(oldestInboxCreatedAt);
	const oldestInboxDayNumber = Math.floor(
		Date.UTC(
			oldestInboxDate.getFullYear(),
			oldestInboxDate.getMonth(),
			oldestInboxDate.getDate(),
		) /
			(24 * 60 * 60 * 1000),
	);

	return {
		generatedAt: todayDate.getTime(),
		noteCount: notes.length,
		activity,
		activeNoteDays: activity.filter((day) => day.count > 0).length,
		paths,
		periodLinks: [...periodLinks],
		inbox: {
			count: inboxNotes.length,
			oldestDays:
				inboxNotes.length === 0
					? 0
					: Math.max(0, todayDayNumber - oldestInboxDayNumber),
		},
		tasks: dashboardTasks,
		taskFlow,
		health,
	};
}
