import type { GitOptions, ParsedCommit } from '@monup/git';
import type { GitHubOptions } from '@monup/github';
import type { ReleaseOptions } from '@monup/release';
import type { PackageInfo } from '@monup/workspace';
import type { ChangelogOptions } from './options.ts';
/**
 * Changelog generation from conventional commits
 */
import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { filterCommitsByPackage, getCommits, getFirstCommit, getGitHubRepo, getGlobalTagHistory, getLastPackageTag, getLastTag, getPackageTagHistory } from '@monup/git';
import { sortVersionsDescending } from '@monup/utils';
import { getPreviousVersion } from '@monup/version';
import { fs } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { formatChangelogSections, groupCommits } from './formatter.ts';
import { logger } from './logger.ts';
import { createVersionMarkers, extractVersionChangelog, findVersionBlocks, findVersionMarkers } from './markers.ts';
import { resolveChangelogPath } from './path-resolver.ts';
import { resolveVersionWithFallback } from './version-utils.ts';

export { buildCommitUrl, formatChangelogSections, formatCommitMessage, groupCommits } from './formatter.ts';
export { logger } from './logger.ts';
export { createVersionMarkers, extractVersionChangelog, findVersionBlocks, findVersionMarkers } from './markers.ts';

export const _VERSION: string = packageJson.version;

/** Resolves formatter options for optional commit links. */
async function resolveFormatterOptions(changelogOpts: ChangelogOptions): Promise<ChangelogOptions> {
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
	return optsForFormatter;
}

/** Builds one marker-wrapped changelog block for a version/package. */
async function buildChangelogEntry(
	version: string,
	commits: ParsedCommit[],
	packageName: string,
	options: ChangelogOptions,
): Promise<string> {
	logger.debug('Building changelog entry', { version, packageName, commitCount: commits.length });
	const grouped = groupCommits(commits, options);
	const optsForFormatter = await resolveFormatterOptions(options);
	const sections = formatChangelogSections(grouped, optsForFormatter);
	if (sections.length === 0) {
		const emptyVersionText = optsForFormatter.titles?.emptyVersion ?? 'No significant changes';
		if (emptyVersionText.length > 0) {
			sections.push(`${emptyVersionText}`, '');
		}
	}
	const markers = createVersionMarkers(version, packageName);
	const date = new Date().toISOString().split('T')[0];
	const header = `## ${packageName}@${version} - ${date}`;
	return [markers.start, header, '', ...sections, markers.end].join('\n');
}

/** Extracts existing marker blocks keyed by version for one package changelog. */
function getCachedBlocksByVersion(changelogContent: string, packageName: string): Map<string, string> {
	const cached = new Map<string, string>();
	for (const block of findVersionBlocks(changelogContent)) {
		if (block.packageName !== packageName) {
			continue;
		}
		if (!cached.has(block.version)) {
			cached.set(block.version, block.content);
		}
	}
	return cached;
}

/** Renders full changelog file content from version blocks in descending order. */
function renderChangelogFromBlocks(blocksByVersion: Map<string, string>): string {
	const sortedVersions = sortVersionsDescending(Array.from(blocksByVersion.keys()));
	const blocks = sortedVersions
		.map((version) => blocksByVersion.get(version))
		.filter((block): block is string => typeof block === 'string' && block.length > 0);
	if (blocks.length === 0) {
		return '# Changelog\n';
	}
	return `# Changelog\n\n${blocks.join('\n\n')}\n`;
}

/** Returns true when a changelog file already exists. */
async function changelogExists(changelogLocation: string): Promise<boolean> {
	try {
		await fs.stat(changelogLocation);
		return true;
	}
	catch {
		return false;
	}
}

/** Writes a complete changelog file from prepared blocks. */
async function writeChangelogFromBlocks(
	changelogLocation: string,
	blocksByVersion: Map<string, string>,
): Promise<void> {
	const content = renderChangelogFromBlocks(blocksByVersion);
	await fs.mkdir(dirname(changelogLocation), { recursive: true });
	await fs.writeFile(changelogLocation, content, 'utf-8');
}

/** Rebuilds and writes full changelog file using generated + cached version blocks. */
async function rebuildChangelogFile(
	changelogLocation: string,
	packageName: string,
	version: string,
	generatedBlock: string,
): Promise<void> {
	let existingContent = '';
	try {
		existingContent = await fs.readFile(changelogLocation, 'utf-8');
		logger.trace('Read existing changelog for rebuild', { changelogLocation, length: existingContent.length });
	}
	catch {
		logger.trace('Changelog does not exist for rebuild, creating new file', { changelogLocation });
	}

	const blocksByVersion = getCachedBlocksByVersion(existingContent, packageName);
	blocksByVersion.set(version, generatedBlock);
	const rebuiltContent = renderChangelogFromBlocks(blocksByVersion);

	await fs.mkdir(dirname(changelogLocation), { recursive: true });
	await fs.writeFile(changelogLocation, rebuiltContent, 'utf-8');
	logger.debug('Changelog rebuilt successfully', { changelogLocation, versions: blocksByVersion.size });
}

/** Selects commits relevant to one package from streamed commit output. */
function selectCommitsForPackage(
	commits: ParsedCommit[],
	pkg: PackageInfo,
	allPackages: PackageInfo[],
): ParsedCommit[] {
	const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, allPackages);
	const scopedPackageCommits = scopedCommits.get(pkg.name) ?? [];
	const isRootPackage = pkg.path === '.' || pkg.path === pkg.root;
	return isRootPackage
		? [...scopedPackageCommits, ...Array.from(unscopedCommits)]
		: scopedPackageCommits;
}

/** Builds historical blocks from adjacent global tag intervals. */
async function buildGlobalBootstrapBlocks(
	packageName: string,
	options: ChangelogOptions,
	root: string,
	packages: PackageInfo[],
	tagTemplate?: string,
	targetPackage?: PackageInfo,
): Promise<Map<string, string>> {
	const tags = await getGlobalTagHistory(tagTemplate, undefined, root);
	if (tags.length === 0) {
		return new Map();
	}

	const blocksByVersion = new Map<string, string>();
	for (let idx = 0; idx < tags.length; idx += 1) {
		const currentTag = tags[idx];
		const previousTag = idx > 0 ? tags[idx - 1] : undefined;
		const intervalCommits = await getCommits(previousTag?.tag, currentTag.tag, packages, root);
		const commitsForBlock = typeof targetPackage === 'object'
			? selectCommitsForPackage(intervalCommits, targetPackage, packages)
			: intervalCommits;
		const block = await buildChangelogEntry(currentTag.version, commitsForBlock, packageName, options);
		blocksByVersion.set(currentTag.version, block);
	}

	return blocksByVersion;
}

/** Builds historical blocks from adjacent package tag intervals. */
async function buildPackageBootstrapBlocks(
	pkg: PackageInfo,
	options: ChangelogOptions,
	root: string,
	allPackages: PackageInfo[],
): Promise<Map<string, string>> {
	const tags = await getPackageTagHistory(pkg.name, root);
	if (tags.length === 0) {
		return new Map();
	}

	const firstCommit = await getFirstCommit(root);
	const blocksByVersion = new Map<string, string>();
	for (let idx = 0; idx < tags.length; idx += 1) {
		const currentTag = tags[idx];
		const previousTag = idx > 0 ? tags[idx - 1] : undefined;
		const fromRef = typeof previousTag?.tag === 'string' ? previousTag.tag : firstCommit;
		const intervalCommits = await getCommits(fromRef, currentTag.tag, allPackages, root);
		const packageCommits = selectCommitsForPackage(intervalCommits, pkg, allPackages);
		const block = await buildChangelogEntry(currentTag.version, packageCommits, pkg.name, options);
		blocksByVersion.set(currentTag.version, block);
	}

	return blocksByVersion;
}

/** Synchronizes a changelog to finalized tagged version blocks only. */
async function syncChangelogToTaggedBlocks(
	packageName: string,
	changelogPath: string,
	packages: PackageInfo[],
	options: ChangelogRunOptions,
	pkg?: PackageInfo,
): Promise<boolean> {
	const blocksByVersion = options.git.tagStrategy === 'package' && typeof pkg === 'object'
		? await buildPackageBootstrapBlocks(pkg, options.changelog, options.root, packages)
		: await buildGlobalBootstrapBlocks(
			packageName,
			options.changelog,
			options.root,
			packages,
			options.git.tagTemplate,
			pkg,
		);
	if (blocksByVersion.size === 0) {
		return false;
	}

	await writeChangelogFromBlocks(changelogPath, blocksByVersion);
	logger.debug('Synchronized changelog to tagged blocks', {
		package: packageName,
		versionCount: blocksByVersion.size,
	});
	return true;
}

/** Gets commits for the latest changelog update interval instead of full history. */
async function getLatestIntervalCommits(
	pkg: PackageInfo | undefined,
	packages: PackageInfo[],
	fallbackCommits: ParsedCommit[],
	options: ChangelogRunOptions,
): Promise<ParsedCommit[]> {
	try {
		if (typeof pkg === 'object') {
			if (options.git.tagStrategy === 'package') {
				const lastPackageTag = await getLastPackageTag(pkg.name, options.root);
				if (typeof lastPackageTag === 'string') {
					return await getCommits(lastPackageTag, 'HEAD', [pkg], options.root);
				}
			}
			else {
				const lastTag = await getLastTag(undefined, options.git.tagTemplate, undefined, options.root);
				if (typeof lastTag === 'string') {
					const commitsSinceTag = await getCommits(lastTag, 'HEAD', packages, options.root);
					return selectCommitsForPackage(commitsSinceTag, pkg, packages);
				}
			}
		}
		else {
			const lastTag = await getLastTag(undefined, options.git.tagTemplate, undefined, options.root);
			if (typeof lastTag === 'string') {
				return await getCommits(lastTag, 'HEAD', packages, options.root);
			}
		}
	}
	catch(error: unknown) {
		logger.debug('Failed to resolve latest interval commits, falling back to provided commits', {
			package: pkg?.name,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	return fallbackCommits;
}

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
	const content = await buildChangelogEntry(version, commits, packageName, changelogOpts);

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
	catch(error: unknown) {
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
		const changelogPath = resolve(options.root, options.changelog.location);
		const hasExistingChangelog = await changelogExists(changelogPath);
		if (!hasExistingChangelog) {
			try {
				const bootstrapBlocks = await buildGlobalBootstrapBlocks(
					'root',
					options.changelog,
					options.root,
					packages,
					options.git.tagTemplate,
					undefined,
				);
				if (bootstrapBlocks.size > 0) {
					await writeChangelogFromBlocks(changelogPath, bootstrapBlocks);
					logger.debug('Bootstrapped root changelog from tag intervals', { versionCount: bootstrapBlocks.size });
					return;
				}
			}
			catch(error: unknown) {
				logger.debug('Skipping root bootstrap from tags', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		else {
			try {
				const synced = await syncChangelogToTaggedBlocks('root', changelogPath, packages, options);
				if (synced) {
					return;
				}
			}
			catch(error: unknown) {
				logger.debug('Skipping root tagged sync', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const latestIntervalCommits = await getLatestIntervalCommits(undefined, packages, commits, options);
		let existingVersion: string | undefined;
		try {
			existingVersion = await getLatestVersionFromChangelog(undefined, options.changelog, changelogPath);
		}
		catch(error: unknown) {
			logger.debug('Failed to get version from changelog', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		let version = existingVersion;

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
			catch(error: unknown) {
				logger.debug('Failed to get previous version', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const finalVersion = resolveVersionWithFallback(version, options.changelog, 'root');
		if (latestIntervalCommits.length === 0 && existingVersion === finalVersion) {
			logger.info('No new commits for latest root changelog version, skipping update');
			return;
		}
		const generatedBlock = await buildChangelogEntry(finalVersion, latestIntervalCommits, 'root', options.changelog);
		await rebuildChangelogFile(changelogPath, 'root', finalVersion, generatedBlock);
		return;
	}

	for (const pkg of packages) {
		const packageCommits = selectCommitsForPackage(commits, pkg, packages);
		const changelogPath = resolve(pkg.path, options.changelog.location);
		const hasExistingChangelog = await changelogExists(changelogPath);
		if (!hasExistingChangelog) {
			try {
				const bootstrapBlocks = options.git.tagStrategy === 'package'
					? await buildPackageBootstrapBlocks(pkg, options.changelog, options.root, packages)
					: await buildGlobalBootstrapBlocks(
						pkg.name,
						options.changelog,
						options.root,
						packages,
						options.git.tagTemplate,
						pkg,
					);
				if (bootstrapBlocks.size > 0) {
					await writeChangelogFromBlocks(changelogPath, bootstrapBlocks);
					logger.debug('Bootstrapped package changelog from tag intervals', {
						package: pkg.name,
						versionCount: bootstrapBlocks.size,
					});
					continue;
				}
			}
			catch(error: unknown) {
				logger.debug('Skipping package bootstrap from tags', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		else {
			try {
				const synced = await syncChangelogToTaggedBlocks(pkg.name, changelogPath, packages, options, pkg);
				if (synced) {
					continue;
				}
			}
			catch(error: unknown) {
				logger.debug('Skipping package tagged sync', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		if (packageCommits.length === 0) {
			logger.info(`No commits for ${pkg.name}, skipping changelog`);
			continue;
		}
		const latestIntervalCommits = await getLatestIntervalCommits(pkg, packages, packageCommits, options);
		let existingVersion: string | undefined;
		try {
			existingVersion = await getLatestVersionFromChangelog(pkg.name, options.changelog, changelogPath);
		}
		catch(error: unknown) {
			logger.debug('Failed to get existing version from changelog', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
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
		catch(error: unknown) {
			logger.debug('Failed to get previous version', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (typeof version !== 'string') {
			try {
				version = await getLatestVersionFromChangelog(pkg.name, options.changelog, changelogPath);
			}
			catch(error: unknown) {
				logger.debug('Failed to get version from changelog', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const finalVersion = resolveVersionWithFallback(version, options.changelog, pkg.name);
		if (latestIntervalCommits.length === 0 && existingVersion === finalVersion) {
			logger.info(`No new commits for latest changelog version of ${pkg.name}, skipping update`);
			continue;
		}
		const generatedBlock = await buildChangelogEntry(finalVersion, latestIntervalCommits, pkg.name, options.changelog);
		await rebuildChangelogFile(changelogPath, pkg.name, finalVersion, generatedBlock);
	}
}

export type { ChangelogOptions, ConventionalCommitType } from './options.ts';
export { defaultChangelogOptions } from './options.ts';
export { resolveVersionWithFallback } from './version-utils.ts';
