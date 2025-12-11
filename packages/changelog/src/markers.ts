/**
 * HTML comment marker utilities for changelog version extraction
 */

import { regex } from 'arkregex';

/**
 * Creates HTML comment markers for a version
 */
export function createVersionMarkers(
	version: string,
	packageName: string,
): { start: string; end: string } {
	return {
		start: `<!-- monup:version:${version}:${packageName}:start -->`,
		end: `<!-- monup:version:${version}:${packageName}:end -->`,
	};
}

/**
 * Extracts changelog content for a specific version using markers
 */
export function extractVersionChangelog(
	changelogContent: string,
	version: string,
	packageName?: string,
): string | undefined {
	// Build regex pattern
	const packagePattern = typeof packageName === 'string' ? `:${packageName}` : ':[^:]+';
	const pattern = regex(
		`<!-- monup:version:${version.replace(/\./g, '\\.')}${packagePattern}:start -->([\\s\\S]*?)<!-- monup:version:${version.replace(/\./g, '\\.')}${packagePattern}:end -->`,
	);

	const match = changelogContent.match(pattern);
	return match ? match[1].trim() : undefined;
}

/**
 * Finds all version markers in a changelog
 */
export function findVersionMarkers(changelogContent: string): Array<{
	version: string;
	packageName: string;
	startIndex: number;
	endIndex: number;
}> {
	const markers: Array<{
		version: string;
		packageName: string;
		startIndex: number;
		endIndex: number;
	}> = [];

	const startPattern = /<!-- monup:version:([^:]+):([^:]+):start -->/g;

	let match = startPattern.exec(changelogContent);
	while (match !== null) {
		const version = match[1];
		const packageName = match[2];
		const startIndex = match.index;

		// Find corresponding end marker
		const endMatch = regex(
			`<!-- monup:version:${version.replace(/\./g, '\\.')}:${packageName}:end -->`,
		).exec(changelogContent.slice(startIndex));

		if (endMatch) {
			markers.push({
				version,
				packageName,
				startIndex,
				endIndex: startIndex + endMatch.index + endMatch[0].length,
			});
		}

		match = startPattern.exec(changelogContent);
	}

	return markers;
}
