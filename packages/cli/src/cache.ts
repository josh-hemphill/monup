/**
 * CLI cache for storing parsed data across command invocations
 * Reduces redundant parsing of packages, commits, tags, and versions
 */
import type { PackageInfo } from '@monup/workspace';
import type { ParsedCommit } from '@monup/git';

/**
 * Cache storage interface
 */
interface CacheStorage {
	packages: PackageInfo[] | undefined;
	commits: Map<string, ParsedCommit[]>;
	tags: string[] | undefined;
	versions: Map<string, string | undefined>;
}

/**
 * Global cache instance
 * Lifecycle: Created at CLI start, cleared at CLI end
 */
let cache: CacheStorage | undefined;

/**
 * Initializes the cache
 * Should be called at the start of CLI execution
 */
export function initCache(): void {
	if (typeof cache === 'undefined') {
		cache = {
			packages: undefined,
			commits: new Map(),
			tags: undefined,
			versions: new Map(),
		};
	}
}

/**
 * Clears the cache
 * Should be called at the end of CLI execution
 */
export function clearCache(): void {
	cache = undefined;
}

/**
 * Gets cached packages or undefined if not cached
 */
export function getCachedPackages(): PackageInfo[] | undefined {
	return cache?.packages;
}

/**
 * Sets cached packages
 */
export function setCachedPackages(packages: PackageInfo[]): void {
	if (typeof cache !== 'undefined') {
		cache.packages = packages;
	}
}

/**
 * Gets cached commits for a specific range
 * @param key - Cache key (typically the from tag or commit range)
 */
export function getCachedCommits(key: string): ParsedCommit[] | undefined {
	return cache?.commits.get(key);
}

/**
 * Sets cached commits for a specific range
 * @param key - Cache key (typically the from tag or commit range)
 * @param commits - Commits to cache
 */
export function setCachedCommits(key: string, commits: ParsedCommit[]): void {
	if (typeof cache !== 'undefined') {
		cache.commits.set(key, commits);
	}
}

/**
 * Gets cached tags or undefined if not cached
 */
export function getCachedTags(): string[] | undefined {
	return cache?.tags;
}

/**
 * Sets cached tags
 */
export function setCachedTags(tags: string[]): void {
	if (typeof cache !== 'undefined') {
		cache.tags = tags;
	}
}

/**
 * Gets cached version for a specific package
 * @param packageName - Package name
 */
export function getCachedVersion(packageName: string): string | undefined {
	return cache?.versions.get(packageName);
}

/**
 * Sets cached version for a specific package
 * @param packageName - Package name
 * @param version - Version to cache (undefined to cache "not found")
 */
export function setCachedVersion(packageName: string, version: string | undefined): void {
	if (typeof cache !== 'undefined') {
		cache.versions.set(packageName, version);
	}
}

