/**
 * Package-based commit filtering utilities
 */

import type { ParsedCommit } from './parser.ts';
import { logger } from './logger.ts';

export interface PackageInfo {
	name: string;
	path: string;
	root: string;
}

/**
 * Filters commits by which packages they touched
 */
export function filterCommitsByPackage(
	commits: ParsedCommit[],
	packages: PackageInfo[],
): { scopedCommits: Map<string, ParsedCommit[]>; unscopedCommits: Set<ParsedCommit> } {
	logger.debug('Filtering commits by package', { commitCount: commits.length, packageCount: packages.length });
	const scopedCommits = new Map<string, ParsedCommit[]>();

	// Initialize map with empty arrays for each package
	for (const pkg of packages) {
		scopedCommits.set(pkg.name, []);
	}
	logger.debug('Initialized package commit map', { packages: packages.map((p) => p.name) });

	// Filter commits based on packages touched
	const unscopedCommits = new Set<ParsedCommit>();
	for (const commit of commits) {
		if (typeof commit.packages === 'undefined' || commit.packages.length === 0) {
			// If no package info, skip
			unscopedCommits.add(commit);
			logger.debug('Skipping commit without package info', { hash: commit.hash?.slice(0, 7) });
			continue;
		}

		// Add commit to all touched packages
		for (const pkgName of commit.packages) {
			const existing = scopedCommits.get(pkgName);
			const commits = Array.isArray(existing) ? existing : [];
			commits.push(commit);
			scopedCommits.set(pkgName, commits);
			logger.debug('Added commit to package', { package: pkgName, hash: commit.hash?.slice(0, 7) });
		}
	}

	logger.debug('Finished filtering commits', { unscopedCommits: unscopedCommits.size });

	return {
		scopedCommits,
		unscopedCommits,
	};
}

/**
 * Determines if a file path belongs to a package
 * @deprecated Use packages array in ParsedCommit instead
 */
export function fileBelongsToPackage(filePath: string, pkg: PackageInfo): boolean {
	const normalizedPath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
	return normalizedPath.startsWith(pkg.path) || normalizedPath.startsWith(pkg.root);
}
