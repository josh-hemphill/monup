/**
 * Changelog command handler
 */
import type { ParsedCommit } from '@monup/git';
import type { ResolvedMonupOptions } from '@monup/options';
import { cwd } from 'node:process';
import { runChangelog } from '@monup/changelog';
import { getCommitsSinceLastTag } from '@monup/git';
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

	await (runChangelog as (
		workflowOptions: {
			changelog: ResolvedMonupOptions['changelog'];
			git: ResolvedMonupOptions['git'];
			release: ResolvedMonupOptions['release'];
			github: ResolvedMonupOptions['github'];
			root: string;
		},
		packageList: typeof packages,
		commitList: ParsedCommit[],
	) => Promise<void>)({
		changelog: options.changelog,
		git: options.git,
		release: options.release,
		github: options.github,
		root: workspaceRoot,
	}, packages, commits);
}
