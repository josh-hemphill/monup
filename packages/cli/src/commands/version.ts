/**
 * Version command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { createCommit, createTag, filterCommitsByPackage, formatTag, getCommits, getLastPackageTag, getLastPackageTags, getLastTag, pushToRemote } from '@monup/git';
import { calculateVersion, getCurrentVersionFromFile, updateVersionInAdditionalFiles, updateVersionInFile } from '@monup/version';
import { getCachedCommits, setCachedCommits } from '../cache.ts';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

/**
 * Handles the version command
 */
export async function handleVersion(
	options: ResolvedMonupOptions,
	bumpType?: 'major' | 'minor' | 'patch',
): Promise<void> {
	logger.debug('Handling version command', { bumpType });

	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}

	logger.debug('Processing packages', { count: packages.length, packages: packages.map((p) => p.name) });

	// Get git commits since last tag (use cache if available)
	// For per-package tag strategy, we need to get commits per package
	let commits: Awaited<ReturnType<typeof getCommits>>;
	const commitCacheKey = options.git.tagStrategy === 'package' ? 'perPackage' : 'global';
	const cachedCommits = getCachedCommits(commitCacheKey);

	if (typeof cachedCommits !== 'undefined') {
		commits = cachedCommits;
		logger.debug('Using cached commits');
	}
	else {
		if (options.git.tagStrategy === 'package') {
			// For per-package strategy, get commits from the earliest package tag
			// Collect all package names first, then get all tags in one git call
			const packageNames = packages.map((pkg) => pkg.name);
			const packageTagMap = await getLastPackageTags(packageNames);

			// We'll collect all commits across all packages
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

	// Process each package
	for (const pkg of packages) {
		logger.debug('Processing package', { name: pkg.name, path: pkg.path });
		if (typeof pkg.packageFile !== 'string') {
			logger.trace('Package has no package file, skipping', { name: pkg.name });
			continue;
		}

		// Get current version
		const currentVersion = await getCurrentVersionFromFile(pkg.packageFile);
		if (typeof currentVersion !== 'string') {
			logger.warn(`No version found for ${pkg.name}, skipping`);
			continue;
		}
		logger.debug('Current version retrieved', { package: pkg.name, version: currentVersion });

		// Filter commits for this package
		// For per-package tag strategy, get commits since last package tag
		let commitsList: Awaited<ReturnType<typeof getCommits>>;
		if (options.git.tagStrategy === 'package') {
			try {
				const lastPackageTag = await getLastPackageTag(pkg.name);
				if (typeof lastPackageTag === 'string') {
					commitsList = await getCommits(lastPackageTag);
				}
				else {
					// No previous tag for this package, filter commits by package
					const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, [pkg]);
					// Determine if this is a root package (gets unscoped commits too)
					const isRootPackage = pkg.path === '.' || pkg.path === pkg.root;
					const scopedPackageCommits = scopedCommits.get(pkg.name) ?? [];
					commitsList = isRootPackage
						? [...scopedPackageCommits, ...Array.from(unscopedCommits)]
						: scopedPackageCommits;
				}
			}
			catch (error: unknown) {
				logger.debug('Failed to get last package tag', {
					package: pkg.name,
					error: error instanceof Error ? error.message : String(error),
				});
				// Fallback to filtered commits
				const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, [pkg]);
				// Determine if this is a root package (gets unscoped commits too)
				const isRootPackage = pkg.path === '.' || pkg.path === pkg.root;
				const scopedPackageCommits = scopedCommits.get(pkg.name) ?? [];
				commitsList = isRootPackage
					? [...scopedPackageCommits, ...Array.from(unscopedCommits)]
					: scopedPackageCommits;
			}
		}
		else {
			// Global tag strategy - all packages share the same commits (no filtering needed)
			commitsList = commits;
		}
		logger.debug('Package commits filtered', { package: pkg.name, count: commitsList.length });

		// Calculate next version
		logger.debug('Calculating next version', { package: pkg.name, currentVersion, commitCount: commitsList.length, bumpType });
		const { nextVersion } = calculateVersion(
			currentVersion,
			commitsList,
		);

		const finalVersion = typeof nextVersion === 'string' ? nextVersion : currentVersion;
		logger.debug('Version calculation result', { package: pkg.name, currentVersion, nextVersion, finalVersion, bumpType });

		if (finalVersion === currentVersion && typeof bumpType === 'undefined') {
			logger.info(`No version bump needed for ${pkg.name}`);
			continue;
		}

		// Update version in package file
		logger.debug('Updating version in package file', { package: pkg.name, version: finalVersion });
		await updateVersionInFile(pkg.packageFile, finalVersion);

		// Update version in additional files
		if (options.version.files.length > 0) {
			logger.debug('Updating version in additional files', { package: pkg.name, fileCount: options.version.files.length });
			await updateVersionInAdditionalFiles(
				options.version.files,
				currentVersion,
				finalVersion,
			);
		}

		// Git operations
		if (options.git.commit) {
			logger.debug('Creating git commit', { package: pkg.name });
			const tagName = options.git.tagStrategy === 'package'
				? `${pkg.name}@${finalVersion}`
				: formatTag(options.git.tagTemplate, finalVersion);
			logger.trace('Tag name determined', { package: pkg.name, tagName });

			await createCommit(
				`chore: bump ${pkg.name} to ${finalVersion}`,
				[pkg.packageFile, ...options.version.files],
				options.git.sign,
				options.git.noVerify,
			);

			if (options.git.tag) {
				logger.debug('Creating git tag', { package: pkg.name, tagName });
				await createTag(tagName, `Release ${pkg.name} ${finalVersion}`, options.git.sign);
			}
		}
	}

	// Push if configured
	if (options.git.push) {
		logger.debug('Pushing to remote');
		await pushToRemote();
	}
	logger.debug('Version command completed');
}
