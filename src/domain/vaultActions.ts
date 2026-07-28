export function sanitizeFileName(value: string): string {
	return value
		.replace(/[\\/:*?"<>|#^[\]]/gu, '')
		.replace(/\s+/gu, ' ')
		.trim()
		.slice(0, 80);
}

export function buildDiaryContent(date: string): string {
	return `# ${date}\n\n## Tasks\n\n- [ ] \n\n## Notes\n`;
}

export function buildInboxContent(
	title: string,
	content: string,
	createdAt: string,
): string {
	return [
		'---',
		'status: inbox',
		`created: ${createdAt}`,
		'---',
		'',
		`# ${title}`,
		'',
		content.trim(),
		'',
	].join('\n');
}
