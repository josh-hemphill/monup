import type { PackageInfo } from './filter.ts';
import type { ParsedCommit } from './parser.ts';
/**
 * Git operations via zx shell processes
 */
import { cwd, stderr } from 'node:process';
import { regex } from 'arkregex';
import { $ } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { logger } from './logger.ts';
import { parseGitLog } from './parser.ts';
import { streamGitCommits } from './streamer.ts';

export type { PackageInfo } from './filter.ts';
export { filterCommitsByPackage } from './filter.ts';
export { logger } from './logger.ts';
export { createCommit, createTag, formatTag, pushToRemote } from './operations.ts';
export type { GitOptions, ResolvedGitOptions } from './options.ts';
export { defaultGitOptions } from './options.ts';
export { parseConventionalCommit, type ParsedCommit, parseGitLog } from './parser.ts';

export const _VERSION: string = packageJson.version;
/**
 * Gets git commits in a range
 * Returns structured commit data with package information
 * Uses streaming to process git output in chunks and maps files to packages
 * @param from - Start commit/tag (exclusive)
 * @param to - End commit/tag (inclusive), defaults to HEAD if from is provided
 * @param includePackages - Whether to include package information (default: true)
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getCommits(
	from?: string,
	to?: string,
	includePackages: PackageInfo[] = [] as PackageInfo[],
	root: string = cwd(),
): Promise<ParsedCommit[]> {
	logger.debug('Getting git commits', { from, to, includePackages, root });
	const format = '%H|%an|%ae|%ad|%s|%b';
	const args = ['log', `--format=${format}`, '--date=iso'];

	if (typeof from === 'string' && typeof to === 'string') {
		args.push(`${from}..${to}`);
		logger.trace('Using commit range', { from, to });
	}
	else if (typeof from === 'string') {
		args.push(`${from}..HEAD`);
		logger.trace('Using commit range from tag to HEAD', { from });
	}
	else if (typeof to === 'string') {
		args.push(`..${to}`);
		logger.trace('Using commit range to tag', { to });
	}

	if (includePackages.length > 0) {
		args.push('--name-only');
	}

	logger.trace('Git root directory', { root });

	// If we need package info, stream and process in chunks
	if (includePackages.length > 0) {
		const packages = includePackages;
		logger.debug('Using provided packages', { count: packages.length, packages: packages.map((p) => p.name) });
		const gitProcess = $.spawn('git', args, {
			cwd: root,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		// Handle stderr by piping to stderr
		if (gitProcess.stderr !== null && gitProcess.stderr !== undefined) {
			gitProcess.stderr.pipe(stderr);
		}

		const commits: ParsedCommit[] = [];
		let commitCount = 0;
		for await (const commit of streamGitCommits(gitProcess, packages, root)) {
			commits.push(commit);
			commitCount++;
			logger.trace('Processed commit', { hash: commit.hash?.slice(0, 7), type: commit.type, packages: commit.packages });
		}
		logger.debug('Finished processing commits', { count: commitCount });

		// Wait for process to complete and handle errors
		// gitProcess from $.spawn is a ProcessPromise, but we check exit code differently
		try {
			// The process should complete when the stream ends
			// Check if process has exited with an error
			if (typeof gitProcess.exitCode === 'number' && gitProcess.exitCode !== 0) {
				throw new Error(`git log failed with exit code ${gitProcess.exitCode}`);
			}
		}
		catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error('git log failed');
		}

		return commits;
	}

	// Fallback to non-streaming parsing if packages not needed
	logger.debug('Using non-streaming git log parsing');
	const result = await $({ cwd: root })`git ${args}`.quiet();
	const commits = parseGitLog(result.stdout);
	logger.debug('Parsed commits', { count: commits.length });
	return commits;
}

/**
 * Gets all git tags
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getTags(root: string = cwd()): Promise<string[]> {
	logger.debug('Getting git tags', { root });
	const result = await $({ cwd: root })`git tag -l`.quiet();
	const tags = result.stdout
		.trim()
		.split('\n')
		.filter((tag) => tag.length > 0);
	logger.debug('Found tags', { count: tags.length });
	logger.trace('Tags', { tags });
	return tags;
}

/**
 * Gets the current git branch
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getCurrentBranch(root: string = cwd()): Promise<string> {
	const result = await $({ cwd: root })`git rev-parse --abbrev-ref HEAD`.quiet();
	return result.stdout.trim();
}

/**
 * Gets the last tag matching a filter
 * @param filter - Optional filter function for tags
 * @param tagTemplate - Optional template for tag format (e.g., 'v%s')
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getLastTag(
	filter?: (tag: string) => boolean,
	tagTemplate?: string,
	root: string = cwd(),
): Promise<string | undefined> {
	logger.debug('Getting last tag', { hasFilter: typeof filter === 'function', tagTemplate, root });
	const tags = await getTags(root);

	// Filter tags if filter function provided
	const filteredTags = filter ? tags.filter(filter) : tags;
	logger.debug('Filtered tags', { count: filteredTags.length, originalCount: tags.length });

	if (filteredTags.length === 0) {
		logger.debug('No tags found after filtering');
		return undefined;
	}

	// Sort tags (assuming semantic versioning)
	logger.trace('Sorting tags');
	const sorted = filteredTags.sort((a, b) => {
		// Extract version from tag template if provided
		const extractVersion = (tag: string): string => {
			if (typeof tagTemplate === 'string') {
				// Dynamically construct regex pattern - use RegExp for dynamic patterns
				const versionPattern = '(?<version>.+)';
				const patternString = tagTemplate.replace(/%s/g, versionPattern);
				const dynamicPattern = regex(patternString as typeof versionPattern);
				const match = dynamicPattern.exec(tag);
				if (match !== null && typeof match === 'object' && match.groups !== undefined && typeof match.groups === 'object' && match.groups !== null) {
					const groups = match.groups as Record<string, string | undefined>;
					const version = groups.version;
					if (typeof version === 'string') {
						return version;
					}
				}
				return tag;
			}
			const vPrefixRegex = regex('^v');
			return tag.replace(vPrefixRegex, '');
		};

		const vA = extractVersion(a);
		const vB = extractVersion(b);

		// Simple string comparison for semantic versions
		return vB.localeCompare(vA, undefined, { numeric: true, sensitivity: 'base' });
	});

	const lastTag = sorted[0];
	logger.debug('Last tag determined', { tag: lastTag });
	return lastTag;
}

/**
 * Gets the first git commit
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getFirstCommit(root: string = cwd()): Promise<string | undefined> {
	try {
		const result = await $({ cwd: root })`git rev-list --max-parents=0 HEAD`.quiet();
		const trimmed = result.stdout.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	catch {
		return undefined;
	}
}

/**
 * Gets GitHub repository info from git remote
 * @param baseUrl - Base URL for GitHub (default: 'github.com')
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getGitHubRepo(baseUrl = 'github.com', root: string = cwd()): Promise<string | undefined> {
	try {
		const result = await $({ cwd: root })`git remote get-url origin`.quiet();
		const url = result.stdout.trim();

		// Parse various git URL formats
		// git@github.com:user/repo.git
		// https://github.com/user/repo.git
		// https://github.com/user/repo
		const escapedBaseUrl = baseUrl.replace('.', '\\.');
		const patterns = [
			regex(`git@${escapedBaseUrl}:(?<repo>.+?)(?:\\.git)?$`),
			regex(`https?://${escapedBaseUrl}/(?<repo>.+?)(?:\\.git)?$`),
		];

		for (const pattern of patterns) {
			const match = pattern.exec(url);
			if (match !== null && match.groups !== undefined && typeof match.groups.repo === 'string') {
				return match.groups.repo;
			}
		}

		return undefined;
	}
	catch {
		return undefined;
	}
}

/**
 * Checks if current branch is a prerelease branch
 */
export function isPrerelease(branch: string): boolean {
	const prereleasePatterns = [
		regex('^beta', 'i'),
		regex('^alpha', 'i'),
		regex('^rc', 'i'),
		regex('^pre', 'i'),
		regex('^dev', 'i'),
		regex('-beta', 'i'),
		regex('-alpha', 'i'),
		regex('-rc', 'i'),
		regex('-pre', 'i'),
	];

	return prereleasePatterns.some((pattern) => pattern.test(branch));
}
