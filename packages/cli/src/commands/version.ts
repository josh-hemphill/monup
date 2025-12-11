/**
 * Version command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { createCommit, createTag, filterCommitsByPackage, formatTag, getCommits, getLastTag, pushToRemote } from '@monup/git';
import { calculateVersion, getCurrentVersionFromFile, updateVersionInAdditionalFiles, updateVersionInFile } from '@monup/version';
import { detectPackages } from '@monup/workspace';
import { logger } from '../logger.ts';

/**
 * Handles the version command
 */
export async function handleVersion(
	options: ResolvedMonupOptions,
	bumpType?: 'major' | 'minor' | 'patch',
): Promise<void> {
	logger.debug('Handling version command', { bumpType });
	const packages = await detectPackages();

	if (packages.length === 0) {
		logger.error('No packages found in workspace');
		return;
	}

	logger.debug('Processing packages', { count: packages.length, packages: packages.map((p) => p.name) });

	// Get git commits since last tag
	logger.debug('Getting last tag');
	const lastTag = await getLastTag(options.git.tagFilter, options.git.tagTemplate);
	logger.debug('Last tag determined', { lastTag });
	logger.debug('Getting commits since last tag');
	const commits = await getCommits(lastTag);
	logger.debug('Commits retrieved', { count: commits.length });

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
		logger.debug('Filtering commits for package', { package: pkg.name });
		const packageCommitsMap = filterCommitsByPackage(commits, [pkg]);
		const packageCommits = packageCommitsMap.get(pkg.name);
		const commitsList = Array.isArray(packageCommits) ? packageCommits : [];
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
