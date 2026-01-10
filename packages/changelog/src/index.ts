import type { ParsedCommit } from '@monup/git';
import type { ChangelogOptions } from './options.ts';
/**
 * Changelog generation from conventional commits
 */
import { dirname } from 'node:path';
import { sortVersionsDescending } from '@monup/utils';
import { fs } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { formatChangelogSections, groupCommits } from './formatter.ts';
import { logger } from './logger.ts';
import { createVersionMarkers, extractVersionChangelog, findVersionMarkers } from './markers.ts';
import { resolveChangelogPath } from './path-resolver.ts';
import { resolveVersionWithFallback } from './version-utils.ts';

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
	const changelogLocation = resolveChangelogPath(changelogPath, defaultLocation);
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
		existingContent = await fs.readFile(changelogLocation, 'utf-8');
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
	await fs.mkdir(dirname(changelogLocation), { recursive: true });
	await fs.writeFile(changelogLocation, updatedContent, 'utf-8');
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
	const changelogLocation = resolveChangelogPath(changelogPath, defaultLocation);

	try {
		const content = await fs.readFile(changelogLocation, 'utf-8');
		return extractVersionChangelog(content, version, packageName);
	}
	catch {
		return undefined;
	}
}

/**
 * Gets the latest version from a changelog file by reading version markers
 * @param packageName - Package name to filter markers by (optional, if not provided returns latest from any package)
 * @param options - Changelog options
 * @param changelogPath - Optional path to changelog file
 * @returns The latest version string or undefined if no version found
 */
export async function getLatestVersionFromChangelog(
	packageName?: string,
	options?: ChangelogOptions,
	changelogPath?: string,
): Promise<string | undefined> {
	const changelogOpts: ChangelogOptions = typeof options === 'object' && options !== null ? options : {};
	const defaultLocation = typeof changelogOpts.location === 'string' ? changelogOpts.location : 'CHANGELOG.md';
	const changelogLocation = resolveChangelogPath(changelogPath, defaultLocation);

	try {
		const content = await fs.readFile(changelogLocation, 'utf-8');
		const markers = findVersionMarkers(content);

		if (markers.length === 0) {
			logger.debug('No version markers found in changelog');
			return undefined;
		}

		// Filter by package name if provided
		const filteredMarkers = typeof packageName === 'string'
			? markers.filter((m) => m.packageName === packageName)
			: markers;

		if (filteredMarkers.length === 0) {
			logger.debug('No version markers found for package', { packageName });
			return undefined;
		}

		const versions = filteredMarkers.map((m) => m.version);
		const sortedVersions = sortVersionsDescending(versions);
		const latestVersion = sortedVersions.shift();
		logger.debug('Latest version from changelog', { packageName, version: latestVersion });
		return latestVersion ?? undefined;
	}
	catch (error: unknown) {
		logger.debug('Failed to read changelog', {
			changelogLocation,
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	}
}

export type { ChangelogOptions, ConventionalCommitType } from './options.ts';
export { defaultChangelogOptions } from './options.ts';
export { resolveVersionWithFallback } from './version-utils.ts';
