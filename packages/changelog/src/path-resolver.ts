/**
 * Changelog path resolution utilities
 */
import { resolve } from 'node:path';
import { cwd } from 'node:process';

/**
 * Resolves changelog file path
 * @param changelogPath - Optional explicit changelog path
 * @param defaultLocation - Default changelog filename
 * @returns Resolved absolute path to changelog file
 */
export function resolveChangelogPath(
	changelogPath: string | undefined,
	defaultLocation: string,
): string {
	return typeof changelogPath === 'string' ? changelogPath : resolve(cwd(), defaultLocation);
}

