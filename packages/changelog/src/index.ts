import type { GitOptions, ParsedCommit } from '@monup/git';
import { filterCommitsByPackage, getGitHubRepo } from '@monup/git';
import type { GitHubOptions } from '@monup/github';
import type { ReleaseOptions } from '@monup/release';
import type { PackageInfo } from '@monup/workspace';
import type { ChangelogOptions } from './options.ts';
/**
 * Changelog generation from conventional commits
 */
import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { sortVersionsDescending } from '@monup/utils';
import { getPreviousVersion } from '@monup/version';
import { fs } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { formatChangelogSections, groupCommits } from './formatter.ts';
import { logger } from './logger.ts';
import { createVersionMarkers, extractVersionChangelog, findVersionMarkers } from './markers.ts';
import { resolveChangelogPath } from './path-resolver.ts';
import { resolveVersionWithFallback } from './version-utils.ts';

export { buildCommitUrl, formatChangelogSections, formatCommitMessage, groupCommits } from './formatter.ts';
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

	// Resolve commit URL template for links (owner/repo from git remote when template uses them)
	let optsForFormatter: ChangelogOptions = changelogOpts;
	if (changelogOpts.commitLinks && typeof changelogOpts.commitUrlTemplate === 'string' && changelogOpts.commitUrlTemplate.length > 0) {
		const template = changelogOpts.commitUrlTemplate;
		const needsOwnerRepo = template.includes('{{owner}}') || template.includes('{{repo}}');
		if (needsOwnerRepo) {
			const repoSlug = await getGitHubRepo('github.com', cwd());
			if (typeof repoSlug === 'string') {
				const [owner, repo] = repoSlug.split('/');
				if (typeof owner === 'string' && typeof repo === 'string') {
					const resolved = template
						.replace(/\{\{owner\}\}/g, owner)
						.replace(/\{\{repo\}\}/g, repo);
					optsForFormatter = { ...changelogOpts, resolvedCommitUrlTemplate: resolved };
				}
				else {
					optsForFormatter = { ...changelogOpts, resolvedCommitUrlTemplate: '' };
				}
			}
			else {
				optsForFormatter = { ...changelogOpts, resolvedCommitUrlTemplate: '' };
			}
		}
		else {
			optsForFormatter = { ...changelogOpts, resolvedCommitUrlTemplate: template };
		}
	}

	// Format sections
	logger.debug('Formatting changelog sections');
	const sections = formatChangelogSections(grouped, optsForFormatter);
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

export interface ChangelogRunOptions {
	changelog: Required<ChangelogOptions>;
	git: Pick<GitOptions, 'tagStrategy' | 'tagTemplate'>;
	release?: ReleaseOptions;
	github?: GitHubOptions;
	root: string;
}

/**
 * Runs changelog generation across root/per-package strategies.
 */
export async function runChangelog(
	options: ChangelogRunOptions,
	packages: PackageInfo[],
	commits: ParsedCommit[],
): Promise<void> {
	if (options.changelog.strategy === 'root') {
		let version: string | undefined;
		try {
			version = await getLatestVersionFromChangelog(undefined, options.changelog);
		}
		catch (error: unknown) {
			logger.debug('Failed to get version from changelog', {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (typeof version !== 'string' && packages.length > 0 && typeof packages[0]?.packageFile === 'string') {
			try {
				version = await getPreviousVersion(packages[0], {
					tagStrategy: options.git.tagStrategy,
					tagTemplate: options.git.tagTemplate,
					changelog: options.changelog,
					release: options.release,
					github: options.github,
					root: options.root,
				});
			}
			catch (error: unknown) {
				logger.debug('Failed to get previous version', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const finalVersion = resolveVersionWithFallback(version, options.changelog, 'root');
		await generateChangelog(finalVersion, commits, 'root', options.changelog);
		return;
	}

	const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);
	for (const pkg of packages) {
		const isRootPackage = pkg.path === '.' || pkg.path === pkg.root;
		const scopedPackageCommits = scopedCommits.get(pkg.name) ?? [];
		const packageCommits = isRootPackage
			? [...scopedPackageCommits, ...Array.from(unscopedCommits)]
			: scopedPackageCommits;

		if (packageCommits.length === 0) {
			logger.info(`No commits for ${pkg.name}, skipping changelog`);
			continue;
		}

		const changelogPath = resolve(pkg.path, options.changelog.location);
		let version: string | undefined;
		try {
			version = await getPreviousVersion(pkg, {
				tagStrategy: options.git.tagStrategy,
				tagTemplate: options.git.tagTemplate,
				changelog: options.changelog,
				release: options.release,
				github: options.github,
				changelogPath,
				root: options.root,
			});
		}
		catch (error: unknown) {
			logger.debug('Failed to get previous version', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (typeof version !== 'string') {
			try {
				version = await getLatestVersionFromChangelog(pkg.name, options.changelog, changelogPath);
			}
			catch (error: unknown) {
				logger.debug('Failed to get version from changelog', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const finalVersion = resolveVersionWithFallback(version, options.changelog, pkg.name);
		await generateChangelog(finalVersion, packageCommits, pkg.name, options.changelog, changelogPath);
	}
}

export type { ChangelogOptions, ConventionalCommitType } from './options.ts';
export { defaultChangelogOptions } from './options.ts';
export { resolveVersionWithFallback } from './version-utils.ts';
