/**
 * Changelog command handler
 */
import type { ParsedCommit } from '@monup/git';
import type { ResolvedMonupOptions } from '@monup/options';
import { cwd } from 'node:process';
import { runChangelog } from '@monup/changelog';
import { getCommits, getFirstCommit } from '@monup/git';
import { getCachedCommits, setCachedCommits } from '../cache.ts';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

interface CommitRange {
	from: string;
	to: string;
}

/** Resolves changelog commit range from explicit options or first-commit fallback. */
async function resolveChangelogCommitRange(
	gitOptions: ResolvedMonupOptions['git'],
	root: string,
): Promise<CommitRange> {
	const hasExplicitFrom = typeof gitOptions.from === 'string' && gitOptions.from.length > 0;
	const hasExplicitTo = typeof gitOptions.to === 'string' && gitOptions.to.length > 0;
	if (hasExplicitFrom && hasExplicitTo) {
		return {
			from: gitOptions.from as string,
			to: gitOptions.to as string,
		};
	}

	const firstCommit = await getFirstCommit(root);
	if (typeof firstCommit !== 'string') {
		throw new TypeError('Unable to resolve first commit for changelog range');
	}

	return {
		from: firstCommit,
		to: 'HEAD',
	};
}

/**
 * Handles the changelog command
 */
export async function handleChangelog(options: ResolvedMonupOptions): Promise<void> {
	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}
	const workspaceRoot = packages[0]?.root ?? cwd();
	const range = await resolveChangelogCommitRange(options.git, workspaceRoot);

	const commitCacheKey = `range:${range.from}..${range.to}`;
	let commits = getCachedCommits(commitCacheKey);

	if (typeof commits === 'undefined') {
		try {
			commits = await (getCommits as (
				from: string,
				to: string,
				packageList: typeof packages,
				root: string,
			) => Promise<ParsedCommit[]>)(range.from, range.to, packages, workspaceRoot);
		}
		catch(error: unknown) {
			throw new TypeError(`Failed to get changelog commits for range ${range.from}..${range.to}: ${error instanceof Error ? error.message : String(error)}`);
		}
		setCachedCommits(commitCacheKey, commits);
		logger.debug('Commits retrieved', { count: commits.length, from: range.from, to: range.to });
	}
	else {
		logger.debug('Using cached commits', { from: range.from, to: range.to });
	}

	await runChangelog({
		changelog: options.changelog,
		git: options.git,
		release: options.release,
		github: options.github,
		root: workspaceRoot,
	}, packages, commits);
}
