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
}

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
	inbox: {
		count: number;
		oldestDays: number;
	};
	tasks: DashboardTask[];
	taskFlow: TaskFlow;
	health: HealthScore;
}

const TASK_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/u;
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
		const title = rawTitle.replace(DUE_DATE_PATTERN, ' ').trim();
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

export function buildActivityDays(
	notes: readonly { createdAt: number }[],
	today: Date = new Date(),
): ActivityDay[] {
	const counts = new Map<string, number>();
	for (const note of notes) {
		const key = formatLocalDate(new Date(note.createdAt));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	cursor.setDate(cursor.getDate() - 364);

	return Array.from({ length: 365 }, () => {
		const date = formatLocalDate(cursor);
		const day = { date, count: counts.get(date) ?? 0 };
		cursor.setDate(cursor.getDate() + 1);
		return day;
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
	const activity = buildActivityDays(notes, todayDate);
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
