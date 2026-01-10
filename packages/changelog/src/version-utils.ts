/**
 * Version utilities for changelog generation
 */
import type { ChangelogOptions } from './options.ts';
import { logger } from './logger.ts';
import { defaultChangelogOptions } from './options.ts';

/**
 * Resolves version with fallback to default
 * Logs a warning when using the fallback version
 * @param version - Detected version (may be undefined)
 * @param options - Changelog options containing defaultVersion
 * @param context - Context for logging (e.g., package name or 'root')
 * @returns Resolved version string
 */
export function resolveVersionWithFallback(
	version: string | undefined,
	options: ChangelogOptions,
	context: string,
): string {
	const defaultVersion = typeof options.defaultVersion === 'string'
		? options.defaultVersion
		: defaultChangelogOptions.defaultVersion;

	if (typeof version !== 'string') {
		logger.warn(
			`Version could not be determined for ${context}, using default version: ${defaultVersion}`,
		);
		return defaultVersion;
	}

	return version;
}
