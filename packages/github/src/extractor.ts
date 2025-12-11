/**
 * Changelog extraction utilities for GitHub releases
 */
import type { GitHubOptionsWithDeps } from './options.ts';
import { extractChangelogForVersion, generateChangelog } from '@monup/changelog';
import { getCommits } from '@monup/git';

/**
 * Extracts changelog for a version using markers or regeneration
 * Accepts GitHubOptionsWithDeps (includes partial changelog options)
 */
export async function extractChangelogForRelease(
	version: string,
	packageName: string,
	options: GitHubOptionsWithDeps,
	changelogPath?: string,
): Promise<string | undefined> {
	const githubOpts: GitHubOptionsWithDeps = options;
	const method = githubOpts.changelogMethod || 'auto';

	// Try markers first if method is 'auto' or 'markers'
	if (method === 'auto' || method === 'markers') {
		const extracted = await extractChangelogForVersion(
			version,
			packageName,
			githubOpts.changelog || {},
			changelogPath,
		);

		if (typeof extracted === 'string') {
			return extracted;
		}

		// If markers failed and method is 'markers', return undefined
		if (method === 'markers') {
			return undefined;
		}
	}

	// Fallback to regeneration
	if (method === 'auto' || method === 'regenerate') {
		// Get commits for this version range
		// This would need to be determined from git tags
		const commits = await getCommits(); // TODO: Filter by version range

		// Regenerate changelog for this version
		return generateChangelog(version, commits, packageName, githubOpts.changelog || {}, changelogPath);
	}

	return undefined;
}
