/**
 * HTML comment marker utilities for changelog version extraction
 */

import { regex } from 'arkregex';

function escapeForRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
	const markers = findVersionBlocks(changelogContent).map((block) => ({
		version: block.version,
		packageName: block.packageName,
		startIndex: block.startIndex,
		endIndex: block.endIndex,
	}));
	return markers;
}

export interface VersionBlock {
	version: string;
	packageName: string;
	startIndex: number;
	endIndex: number;
	content: string;
}

/**
 * Finds complete version blocks including markers and inner content.
 */
export function findVersionBlocks(changelogContent: string): VersionBlock[] {
	const blocks: VersionBlock[] = [];

	const startPattern = /<!-- monup:version:([^:]+):([^:]+):start -->/g;

	let match = startPattern.exec(changelogContent);
	while (match !== null) {
		const version = match[1];
		const packageName = match[2];
		const startIndex = match.index;

		// Find corresponding end marker
		const escapedVersion = escapeForRegex(version);
		const escapedPackageName = escapeForRegex(packageName);
		const endMatch = regex(
			`<!-- monup:version:${escapedVersion}:${escapedPackageName}:end -->`,
		).exec(changelogContent.slice(startIndex));

		if (endMatch) {
			const endIndex = startIndex + endMatch.index + endMatch[0].length;
			blocks.push({
				version,
				packageName,
				startIndex,
				endIndex,
				content: changelogContent.slice(startIndex, endIndex),
			});
		}

		match = startPattern.exec(changelogContent);
	}

	return blocks;
}
