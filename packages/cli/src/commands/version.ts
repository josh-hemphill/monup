/**
 * Version command handler
 */
import type { ParsedCommit } from '@monup/git';
import type { ResolvedMonupOptions } from '@monup/options';
import { cwd } from 'node:process';
import { getCommitsSinceLastTag } from '@monup/git';
import { runVersionBump } from '@monup/version';
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

	const workspaceRoot = packages[0]?.root ?? cwd();
	const commitCacheKey = options.git.tagStrategy === 'package' ? 'perPackage' : 'global';
	let commits = getCachedCommits(commitCacheKey);
	if (typeof commits === 'undefined') {
		commits = await (getCommitsSinceLastTag as (
			gitOptions: ResolvedMonupOptions['git'],
			packageList: typeof packages,
			root: string,
		) => Promise<ParsedCommit[]>)(options.git, packages, workspaceRoot);
		setCachedCommits(commitCacheKey, commits);
		logger.debug('Commits retrieved', { count: commits.length });
	}
	else {
		logger.debug('Using cached commits');
	}

	await (runVersionBump as (
		workflowOptions: { version: ResolvedMonupOptions['version']; git: ResolvedMonupOptions['git'] },
		packageList: typeof packages,
		context: { workspaceRoot: string; commits: ParsedCommit[]; bumpType?: 'major' | 'minor' | 'patch' },
	) => Promise<void>)(
		{
			version: options.version,
			git: options.git,
		},
		packages,
		{
			workspaceRoot,
			commits,
			bumpType,
		},
	);
	logger.debug('Version command completed');
}
