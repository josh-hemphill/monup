import type { ParsedCommit } from '@monup/git';
import type { ChangelogOptions } from './options.ts';
/**
 * Changelog generation from conventional commits
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import packageJson from '../jsr.json' with { type: 'json' };
import { formatChangelogSections, groupCommits } from './formatter.ts';
import { logger } from './logger.ts';
import { createVersionMarkers, extractVersionChangelog } from './markers.ts';

export { formatChangelogSections, formatCommitMessage, groupCommits } from './formatter.ts';
export { logger } from './logger.ts';
export { createVersionMarkers, extractVersionChangelog, findVersionMarkers } from './markers.ts';

export const _VERSION: string = packageJson.version;

/**
 * Generates changelog from commits
 */
export async function generateChangelog(
	version: string,
	commits: ParsedCommit[],
	packageName: string,
	options: ChangelogOptions,
	changelogPath?: string,
): Promise<string> {
	logger.debug('Generating changelog', { version, packageName, commitCount: commits.length });
	const changelogOpts: ChangelogOptions = options;
	const defaultLocation = typeof changelogOpts.location === 'string' ? changelogOpts.location : 'CHANGELOG.md';
	const changelogLocation = typeof changelogPath === 'string' ? changelogPath : resolve(cwd(), defaultLocation);
	logger.trace('Changelog location', { changelogLocation });

	// Group commits
	logger.debug('Grouping commits');
	const grouped = groupCommits(commits, changelogOpts);
	logger.trace('Commits grouped', { groupCount: grouped.size });

	// Format sections
	logger.debug('Formatting changelog sections');
	const sections = formatChangelogSections(grouped, changelogOpts);
	logger.trace('Sections formatted', { sectionCount: sections.length });

	// Build changelog entry
	const markers = createVersionMarkers(version, packageName);
	const date = new Date().toISOString().split('T')[0];
	const header = `## [${version}] - ${date}`;
	const content = [markers.start, header, '', ...sections, markers.end].join('\n');

	// Read existing changelog if it exists
	let existingContent = '';
	try {
		existingContent = await readFile(changelogLocation, 'utf-8');
		logger.trace('Read existing changelog', { length: existingContent.length });
	}
	catch {
		logger.trace('Changelog does not exist, creating new one');
		// Changelog doesn't exist yet
	}

	// Prepend new entry
	const updatedContent = existingContent
		? `${content}\n\n${existingContent}`
		: `# Changelog\n\n${content}\n`;

	// Write changelog
	logger.debug('Writing changelog', { changelogLocation });
	await mkdir(dirname(changelogLocation), { recursive: true });
	await writeFile(changelogLocation, updatedContent, 'utf-8');
	logger.debug('Changelog written successfully');

	return content;
}

/**
 * Extracts changelog for a specific version
 */
export async function extractChangelogForVersion(
	version: string,
	packageName: string,
	options: ChangelogOptions,
	changelogPath?: string,
): Promise<string | undefined> {
	const changelogOpts: ChangelogOptions = options;
	const defaultLocation = typeof changelogOpts.location === 'string' ? changelogOpts.location : 'CHANGELOG.md';
	const changelogLocation = typeof changelogPath === 'string' ? changelogPath : resolve(cwd(), defaultLocation);

	try {
		const content = await readFile(changelogLocation, 'utf-8');
		return extractVersionChangelog(content, version, packageName);
	}
	catch {
		return undefined;
	}
}

export type { ChangelogOptions, ConventionalCommitType } from './options.ts';
export { defaultChangelogOptions } from './options.ts';
