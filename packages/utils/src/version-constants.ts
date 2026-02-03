import type { Regex } from 'arkregex';
import { regex } from 'arkregex';
/**
 * Shared constants and utilities for version-related operations
 */

/**
 * Regex pattern for matching and replacing version field in JSON files
 * Captures the opening quote and colon, the version value, and the closing quote
 * Usage: content.replace(VERSION_FIELD_REGEX, `$1${newVersion}$2`)
 */
export const VERSION_FIELD_REGEX: Regex<
	| `${string}"version":"${string}"${string}`
	| `${string}"version" ${string}:"${string}"${string}`
	| `${string}"version": ${string}"${string}"${string}`
	| `${string}"version" ${string}: ${string}"${string}"${string}`,
	{
		captures: [
			| '"version":"'
			| `"version" ${string}:"`
			| `"version": ${string}"`
			| `"version" ${string}: ${string}"`,
			'"',
		];
		names: {
			prefix:
			| '"version":"'
			| `"version" ${string}:"`
			| `"version": ${string}"`
			| `"version" ${string}: ${string}"`;
			suffix: '"';
		};
	}
> = regex(
	`(?<prefix>"version" *: *")[^"]+(?<suffix>")`,
);

/**
 * Sorts version strings in descending order (latest first)
 * Uses locale-aware numeric comparison for semantic versioning
 * @param versions - Array of version strings to sort
 * @returns Sorted array (descending order)
 */
export function sortVersionsDescending(versions: string[]): string[] {
	return versions.sort((a, b) => {
		return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
	});
}
