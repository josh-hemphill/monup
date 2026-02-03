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
import { escapeRegex } from './tag-utils.ts';

export type { PackageInfo } from './filter.ts';
export { filterCommitsByPackage } from './filter.ts';
export { logger } from './logger.ts';
export { createCommit, createTag, formatTag, pushToRemote } from './operations.ts';
export type { GitOptions, ResolvedGitOptions } from './options.ts';
export { defaultGitOptions } from './options.ts';
export { parseConventionalCommit, type ParsedCommit, parseGitLog } from './parser.ts';
export {
	escapeRegex,
	extractVersionFromScopedTag,
	extractVersionFromTag,
	extractVersionFromTagByStrategy,
	extractVersionFromTagWithTemplate,
} from './tag-utils.ts';

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
	logger.debug('Using non-streaming git log parsing', { args: args.join(' ') });
	const result = await $({ cwd: root })`git ${args}`.quiet();
	const commits = parseGitLog(result.stdout);
	logger.debug('Parsed commits', { count: commits.length });
	return commits;
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
 * Checks if a git ref (tag, branch, commit) exists
 * @param ref - The ref to check
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function refExists(ref: string, root: string = cwd()): Promise<boolean> {
	try {
		await $({ cwd: root })`git rev-parse --verify ${ref}`.quiet();
		return true;
	}
	catch {
		return false;
	}
}

const scopedTagPattern = regex('^(?<package>[^@]+)@(?<version>.+)$', 'i');
/**
 * Gets the last tags for multiple packages when using scoped tags (package`@`version format)
 * Uses git's pattern matching with multiple patterns to efficiently retrieve all tags in one call
 * @param packageNames - Array of package names to filter tags by
 * @param root - Root directory for git operations (default: current working directory)
 * @returns Map of package name to last tag (undefined if no tag found for that package)
 */
export async function getLastPackageTags(
	packageNames: string[] = [],
	root: string = cwd(),
): Promise<Map<string, string | undefined>> {
	logger.debug('Getting last package tags', { packageCount: packageNames.length, root });

	if (packageNames.length === 0) {
		return new Map();
	}

	// Escape special glob characters in package names and create patterns
	const patterns = packageNames.map((packageName) => {
		const escapedPackageName = packageName.replace(/[*?[\]\\]/g, '\\$&');
		return `${escapedPackageName}@*`;
	});

	// Use git's pattern matching with multiple patterns and sorting
	const args = ['tag', '-l', ...patterns, '--sort=-version:refname'];
	logger.debug('Git tags command', `git ${args.join(' ')}`);
	const result = await $({ cwd: root })`git ${args}`.quiet().lines();
	const allTags = result.filter((tag) => tag.length > 0);

	logger.debug('Filtered package tags', { count: allTags.length, packageCount: packageNames.length });

	// Group tags by package name and find the latest for each
	const packageTagMap = new Map<string, string | undefined>();

	// Initialize all packages to undefined
	for (const packageName of packageNames) {
		packageTagMap.set(packageName, undefined);
	}

	// Process tags and find the latest for each package
	// Tags are already sorted by git, so first occurrence for each package is the latest
	for (const tag of allTags) {
		// Extract package name from tag (format: package@version)
		const match = scopedTagPattern.exec(tag);
		if (match !== null && match.groups !== undefined && typeof match.groups === 'object' && match.groups !== null) {
			const groups = match.groups;
			const tagPackageName = groups.package;
			if (typeof tagPackageName === 'string') {
				// Only update if we haven't found a tag for this package yet (since tags are sorted, first is latest)
				if (packageTagMap.has(tagPackageName) && packageTagMap.get(tagPackageName) === undefined) {
					packageTagMap.set(tagPackageName, tag);
				}
			}
		}
	}

	logger.debug('Last package tags determined', {
		found: Array.from(packageTagMap.entries()).filter(([, tag]) => typeof tag === 'string').length,
		total: packageNames.length,
	});

	return packageTagMap;
}

/**
 * Gets the last tag for a specific package when using scoped tags (package`@`version format)
 * Uses git's pattern matching to filter tags efficiently
 * @param packageName - Package name to filter tags by
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getLastPackageTag(
	packageName: string,
	root: string = cwd(),
): Promise<string | undefined> {
	const result = await getLastPackageTags([packageName], root);
	return result.get(packageName);
}

/**
 * Gets the last global tag (not scoped to a package)
 * @param filter - Optional glob pattern to filter tags via git CLI (e.g., 'v*')
 * @param template - Optional tag template for matching (e.g., 'v%s')
 * @param filterFunction - Optional function to filter tags after retrieving from CLI
 * @param root - Root directory for git operations (default: current working directory)
 */
export async function getLastTag(
	filter?: string,
	template?: string,
	filterFunction?: (tag: string) => boolean,
	root: string = cwd(),
): Promise<string | undefined> {
	logger.debug('Getting last global tag', { filter, template, root, hasFilterFunction: typeof filterFunction === 'function' });

	const args = ['tag', '-l'];

	// Add filter pattern if provided (only for CLI glob patterns, not filter functions)
	if (typeof filter === 'string') {
		args.push(filter);
	}

	// Sort by version
	args.push('--sort=-version:refname');

	const result = await $({ cwd: root })`git ${args}`.quiet().lines();
	let tags = result.filter((tag) => tag.length > 0);

	logger.debug('Found tags', { count: tags.length });

	// Apply filter function if provided (after CLI call)
	if (typeof filterFunction === 'function' && tags.length > 0) {
		tags = tags.filter(filterFunction);
		logger.debug('Filtered tags with filter function', { count: tags.length });
	}

	// If template is provided, filter tags that match the template pattern
	if (typeof template === 'string' && tags.length > 0) {
		// Escape special regex characters in the template, then replace %s with pattern
		const escapedTemplate = escapeRegex(template);
		const versionPattern = escapedTemplate.replace(/%s/g, '.+');
		const templateRegex = new RegExp(`^${versionPattern}$`);
		const matchingTags = tags.filter((tag) => templateRegex.test(tag));

		if (matchingTags.length > 0) {
			logger.debug('Last tag determined', { tag: matchingTags[0] });
			return matchingTags[0];
		}

		logger.debug('No tags matching template found', { template });
		return undefined;
	}

	// Return first tag (latest due to sort)
	if (tags.length > 0) {
		logger.debug('Last tag determined', { tag: tags[0] });
		return tags[0];
	}

	logger.debug('No tags found');
	return undefined;
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
