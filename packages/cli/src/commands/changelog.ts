/**
 * Changelog command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { resolve } from 'node:path';
import { generateChangelog, getLatestVersionFromChangelog, resolveVersionWithFallback } from '@monup/changelog';
import { filterCommitsByPackage, getCommits, getLastPackageTags, getLastTag } from '@monup/git';
import { getPreviousVersion } from '@monup/version';
import { getCachedCommits, setCachedCommits } from '../cache.ts';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

/**
 * Handles the changelog command
 */
export async function handleChangelog(options: ResolvedMonupOptions): Promise<void> {
	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}

	// Get git commits since last tag (use cache if available)
	const commitCacheKey = 'lastTag';
	let commits = getCachedCommits(commitCacheKey);

	if (typeof commits === 'undefined') {
		// Determine last tag based on tag strategy
		if (options.git.tagStrategy === 'package') {
			// For per-package strategy, get commits from each package's last tag
			const packageNames = packages.map((pkg) => pkg.name);
			const packageTagMap = await getLastPackageTags(packageNames);

			// Collect all commits across all packages
			const allCommits: Awaited<ReturnType<typeof getCommits>> = [];
			for (const pkg of packages) {
				try {
					const lastPackageTag = packageTagMap.get(pkg.name);
					if (typeof lastPackageTag === 'string') {
						const packageCommits = await getCommits(lastPackageTag);
						// Merge commits, avoiding duplicates
						for (const commit of packageCommits) {
							if (!allCommits.some((c) => c.hash === commit.hash)) {
								allCommits.push(commit);
							}
						}
					}
				}
				catch (error: unknown) {
					logger.debug('Failed to get commits from last package tag', {
						package: pkg.name,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			// If no package tags found, fall back to global tag
			if (allCommits.length === 0) {
				const lastTag = await getLastTag(undefined, options.git.tagTemplate, options.git.tagFilter);
				commits = await getCommits(lastTag);
			}
			else {
				commits = allCommits;
			}
		}
		else {
			// Global tag strategy
			const lastTag = await getLastTag(undefined, options.git.tagTemplate, options.git.tagFilter);
			logger.debug('Last tag determined', { lastTag });
			commits = await getCommits(lastTag);
		}
		setCachedCommits(commitCacheKey, commits);
		logger.debug('Commits retrieved', { count: commits.length });
	}
	else {
		logger.debug('Using cached commits');
	}

	if (options.changelog.strategy === 'root') {
		// Generate single root changelog
		// Try to get version from changelog or use getPreviousVersion
		let version: string | undefined;
		try {
			version = await getLatestVersionFromChangelog(undefined, options.changelog);
		}
		catch (error: unknown) {
			// Ignore errors
			logger.debug('Failed to get version from changelog', {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		if (typeof version !== 'string') {
			// Try getPreviousVersion with first package as fallback
			if (packages.length > 0 && typeof packages[0].packageFile === 'string') {
				try {
					version = await getPreviousVersion(packages[0], {
						tagStrategy: options.git.tagStrategy,
						tagTemplate: options.git.tagTemplate,
						changelog: options.changelog,
						release: options.release,
						github: options.github,
					});
				}
				catch (error: unknown) {
					logger.debug('Failed to get previous version', {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
		}

		const finalVersion = resolveVersionWithFallback(version, options.changelog, 'root');
		await generateChangelog(finalVersion, commits, 'root', options.changelog);
	}
	else {
		// Generate per-package changelogs
		for (const pkg of packages) {
			// Filter commits for this package
			const packageCommitsMap = filterCommitsByPackage(commits, [pkg]);
			const packageCommits = packageCommitsMap.get(pkg.name) || [];

			if (packageCommits.length === 0) {
				logger.info(`No commits for ${pkg.name}, skipping changelog`);
				continue;
			}

			// Get version using getPreviousVersion
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
				});
			}
			catch (error: unknown) {
				logger.debug('Failed to get previous version', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
			}

			// Fallback: try reading from changelog directly
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
}
