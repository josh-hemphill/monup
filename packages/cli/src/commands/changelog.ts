/**
 * Changelog command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { resolve } from 'node:path';
import { generateChangelog } from '@monup/changelog';
import { filterCommitsByPackage, getCommits, getLastTag } from '@monup/git';
import { detectPackages } from '@monup/workspace';
import { logger } from '../logger.ts';

/**
 * Handles the changelog command
 */
export async function handleChangelog(options: ResolvedMonupOptions): Promise<void> {
	const packages = await detectPackages();

	if (packages.length === 0) {
		logger.error('No packages found in workspace');
		return;
	}

	// Get git commits since last tag
	const lastTag = await getLastTag(options.git.tagFilter, options.git.tagTemplate);
	const commits = await getCommits(lastTag);

	if (options.changelog.strategy === 'root') {
		// Generate single root changelog
		// For root, we'd need to determine a version - this is a simplified version
		const version = '1.0.0'; // TODO: Get from somewhere
		await generateChangelog(version, commits, 'root', options.changelog);
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

			// Get current version
			// TODO: Get version from package file
			const version = '1.0.0'; // Placeholder

			const changelogPath = resolve(pkg.path, options.changelog.location);
			await generateChangelog(version, packageCommits, pkg.name, options.changelog, changelogPath);
		}
	}
}
