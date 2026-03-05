import type { ChangelogOptions } from '@monup/changelog';
import type { GitOptions, ParsedCommit } from '@monup/git';
import type { GitHubOptions } from '@monup/github';
import type { ReleaseOptions } from '@monup/release';
import type { PackageInfo } from '@monup/workspace';
import type { CommitTypeMapping } from './calculator.ts';
import { getLatestVersionFromChangelog } from '@monup/changelog';
import {
	createCommit,
	createTag,
	extractVersionFromScopedTag,
	extractVersionFromTagByStrategy,
	formatTag,
	getCommitsForPackage,
	getLastPackageTag,
	getLastTag,
	pushToRemote,
} from '@monup/git';
import { defaultGitHubOptions, listReleases } from '@monup/github';
import { listPublishedVersions, resolveReleaseOptions } from '@monup/release';
import packageJson from '../jsr.json' with { type: 'json' };
import { calculateBumpType, calculateNextVersion, getCurrentVersion } from './calculator.ts';
import { logger } from './logger.ts';
/**
 * Version calculation and updating
 */
import { DenoJsonUpdater } from './plugins/deno-json.ts';
import { getUpdaters, registerUpdater } from './plugins/index.ts';
import { JsrJsonUpdater } from './plugins/jsr-json.ts';
import { PackageJsonUpdater } from './plugins/package-json.ts';
import { updateVersion, updateVersionInFiles } from './updater.ts';

export const _VERSION: string = packageJson.version;
export { calculateBumpType, calculateNextVersion, type CommitTypeMapping, type VersionBumpType } from './calculator.ts';
export { logger } from './logger.ts';
export type { VersionOptions } from './options.ts';

// Register built-in updaters
registerUpdater(new PackageJsonUpdater());
registerUpdater(new DenoJsonUpdater());
registerUpdater(new JsrJsonUpdater());

/**
 * Calculates the next version based on commits
 */
export function calculateVersion(
	currentVersion: string,
	commits: ParsedCommit[],
	customTypeMapping?: CommitTypeMapping,
): {
	bumpType: 'major' | 'minor' | 'patch' | undefined;
	nextVersion: string | undefined;
} {
	logger.debug('Calculating version', { currentVersion, commitCount: commits.length, hasCustomMapping: typeof customTypeMapping !== 'undefined' });
	const bumpType = calculateBumpType(commits, customTypeMapping);
	logger.debug('Bump type determined', { bumpType });
	const nextVersion = bumpType ? calculateNextVersion(currentVersion, bumpType) : undefined;
	logger.debug('Next version calculated', { nextVersion, currentVersion });

	return {
		bumpType,
		nextVersion,
	};
}

/**
 * Gets the current version from a package file
 */
export async function getCurrentVersionFromFile(filePath: string): Promise<string | undefined> {
	logger.debug('Getting current version from file', { filePath });
	const updaters = getUpdaters();
	const version = await getCurrentVersion(filePath, updaters);
	logger.debug('Current version retrieved', { filePath, version });
	return version;
}

/**
 * Updates version in a package file
 */
export async function updateVersionInFile(
	filePath: string,
	newVersion: string,
): Promise<void> {
	logger.debug('Updating version in file', { filePath, newVersion });
	const updaters = getUpdaters();
	await updateVersion(filePath, newVersion, updaters);
	logger.debug('Version updated successfully', { filePath, newVersion });
}

/**
 * Updates version in additional files
 */
export async function updateVersionInAdditionalFiles(
	files: string[],
	oldVersion: string,
	newVersion: string,
): Promise<void> {
	logger.debug('Updating version in additional files', { fileCount: files.length, oldVersion, newVersion });
	logger.trace('Additional files', { files });
	await updateVersionInFiles(files, oldVersion, newVersion);
	logger.debug('Additional files updated successfully');
}

/**
 * Options for getPreviousVersion function
 */
export interface PreviousVersionOptions {
	/**
	 * Git tag strategy ('package' for scoped tags, 'global' for shared tags)
	 */
	tagStrategy?: 'package' | 'global';
	/**
	 * Tag template (e.g., 'v%s')
	 */
	tagTemplate?: string;
	/**
	 * Changelog options for reading versions from changelog
	 */
	changelog?: ChangelogOptions;
	/**
	 * Release options for querying registries
	 */
	release?: ReleaseOptions;
	/**
	 * GitHub options for querying releases
	 */
	github?: GitHubOptions;
	/**
	 * Changelog file path (optional, will be resolved from options if not provided)
	 */
	changelogPath?: string;
	/**
	 * Root directory for git operations
	 */
	root?: string;
}

/**
 * Options for the version bump workflow.
 */
export interface VersionBumpOptions {
	version: Required<import('./options.ts').VersionOptions>;
	git: Required<Omit<GitOptions, 'tagFilter' | 'from' | 'to'>> & Pick<GitOptions, 'tagFilter' | 'from' | 'to'>;
}

/**
 * Context values used during version bumping.
 */
export interface VersionBumpContext {
	workspaceRoot: string;
	commits: ParsedCommit[];
	bumpType?: 'major' | 'minor' | 'patch';
}

/**
 * Gets the previous version for a package by trying multiple sources
 * Tries in order: package file, git tags, registry, changelog, GitHub releases
 * @param pkg - Package info
 * @param options - Options for version resolution
 * @returns Previous version string or undefined if not found
 */
export async function getPreviousVersion(
	pkg: PackageInfo,
	options: PreviousVersionOptions = {},
): Promise<string | undefined> {
	logger.debug('Getting previous version', { package: pkg.name });

	// 1. Try package file (current version)
	if (typeof pkg.packageFile === 'string') {
		const currentVersion = await getCurrentVersionFromFile(pkg.packageFile);
		if (typeof currentVersion === 'string') {
			logger.debug('Found version in package file', { package: pkg.name, version: currentVersion });
			return currentVersion;
		}
	}

	// 2. Try git tags (scoped if tagStrategy is 'package', global otherwise)
	const tagStrategy = options.tagStrategy ?? 'global';
	const root = typeof options.root === 'string' ? options.root : undefined;
	if (tagStrategy === 'package') {
		const lastTag = await getLastPackageTag(pkg.name, root);
		if (typeof lastTag === 'string') {
			const version = extractVersionFromScopedTag(lastTag);
			if (typeof version === 'string') {
				logger.debug('Found version from scoped git tag', { package: pkg.name, version });
				return version;
			}
		}
	}
	else {
		const tagTemplate = options.tagTemplate;
		const lastTag = await getLastTag(undefined, tagTemplate, undefined, root);
		if (typeof lastTag === 'string') {
			const version = extractVersionFromTagByStrategy(lastTag, tagStrategy, tagTemplate);
			if (typeof version === 'string') {
				logger.debug('Found version from git tag', { package: pkg.name, version });
				return version;
			}
		}
	}

	// 3. Try registry (npm/JSR)
	if (typeof options.release === 'object' && options.release !== null) {
		try {
			const resolvedReleaseOptions = resolveReleaseOptions(options.release);
			const versions = await listPublishedVersions(pkg, resolvedReleaseOptions);
			if (versions.length > 0) {
				const latestVersion = versions[0];
				logger.debug('Found version from registry', { package: pkg.name, version: latestVersion });
				return latestVersion;
			}
		}
		catch(error: unknown) {
			logger.debug('Failed to query registry', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// 4. Try changelog
	if (typeof options.changelog === 'object' && options.changelog !== null) {
		try {
			const version = await getLatestVersionFromChangelog(
				pkg.name,
				options.changelog,
				options.changelogPath,
			);
			if (typeof version === 'string') {
				logger.debug('Found version from changelog', { package: pkg.name, version });
				return version;
			}
		}
		catch(error: unknown) {
			logger.debug('Failed to read changelog', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// 5. Try GitHub releases
	if (typeof options.github === 'object' && options.github !== null) {
		try {
			const githubOptions = {
				...defaultGitHubOptions,
				...options.github,
			};
			const releases = await listReleases(githubOptions);
			if (releases.length > 0) {
				// Filter by package name if using scoped tags
				const relevantReleases = tagStrategy === 'package'
					? releases.filter((r) => r.tag_name.startsWith(`${pkg.name}@`))
					: releases;

				if (relevantReleases.length > 0) {
					const latestRelease = relevantReleases[0];
					const version = latestRelease.version;
					logger.debug('Found version from GitHub releases', { package: pkg.name, version });
					return version;
				}
			}
		}
		catch(error: unknown) {
			logger.debug('Failed to query GitHub releases', {
				package: pkg.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	logger.debug('No previous version found', { package: pkg.name });
	return undefined;
}

/**
 * Runs version bumping across packages using package-specific commit selection.
 */
export async function runVersionBump(
	options: VersionBumpOptions,
	packages: PackageInfo[],
	context: VersionBumpContext,
): Promise<void> {
	for (const pkg of packages) {
		if (typeof pkg.packageFile !== 'string') {
			continue;
		}

		const commitsList = await getCommitsForPackage(
			pkg,
			packages,
			context.commits,
			options.git,
			context.workspaceRoot,
		);
		const currentVersion = await getCurrentVersionFromFile(pkg.packageFile);
		if (typeof currentVersion !== 'string') {
			continue;
		}

		const calculated = calculateVersion(currentVersion, commitsList);
		const nextVersion = typeof context.bumpType === 'string'
			? calculateNextVersion(currentVersion, context.bumpType)
			: calculated.nextVersion;
		const finalVersion = typeof nextVersion === 'string' ? nextVersion : currentVersion;

		if (finalVersion === currentVersion && typeof context.bumpType === 'undefined') {
			continue;
		}

		const pkgWithManifests = pkg as typeof pkg & { packageFiles?: string[] };
		const manifestFiles: string[] = pkgWithManifests.packageFiles ?? [pkg.packageFile];
		for (const file of manifestFiles) {
			await updateVersionInFile(file, finalVersion);
		}

		if (options.version.files.length > 0) {
			await updateVersionInAdditionalFiles(options.version.files, currentVersion, finalVersion);
		}

		if (options.git.commit) {
			const commitFiles: string[] = [...manifestFiles, ...options.version.files];
			const tagName = options.git.tagStrategy === 'package'
				? `${pkg.name}@${finalVersion}`
				: formatTag(options.git.tagTemplate, finalVersion);

			await createCommit(
				`chore: bump ${pkg.name} to ${finalVersion}`,
				commitFiles,
				options.git.sign,
				options.git.noVerify,
				context.workspaceRoot,
			);

			if (options.git.tag) {
				await createTag(tagName, `Release ${pkg.name} ${finalVersion}`, options.git.sign, context.workspaceRoot);
			}
		}
	}

	if (options.git.push) {
		await pushToRemote(undefined, 'origin', context.workspaceRoot);
	}
}

export { defaultVersionOptions } from './options.ts';
export { registerUpdater, type VersionUpdater } from './plugins/index.ts';
