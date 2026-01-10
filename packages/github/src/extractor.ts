import type { GitOptions } from '@monup/git';
/**
 * Changelog extraction utilities for GitHub releases
 */
import type { GitHubOptionsWithDeps } from './options.ts';
import { extractChangelogForVersion, generateChangelog } from '@monup/changelog';
import { formatTag, getCommits, getLastPackageTag, getLastTag } from '@monup/git';

/**
 * Extracts changelog for a version using markers or regeneration
 * Accepts GitHubOptionsWithDeps (includes partial changelog options)
 */
export async function extractChangelogForRelease(
	version: string,
	packageName: string,
	options: GitHubOptionsWithDeps,
	gitOptions: GitOptions,
	changelogPath?: string,
): Promise<string | undefined> {
	const githubOpts = options;
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
		// Determine the previous tag based on git configuration
		let fromTag: string | undefined;

		const tagStrategy = gitOptions.tagStrategy || 'global';
		const tagTemplate = gitOptions.tagTemplate;

		if (tagStrategy === 'package') {
			// For per-package tags, get the last tag for this package
			fromTag = await getLastPackageTag(packageName);
		}
		else {
			// For global tags, get the last tag using filter and template
			fromTag = await getLastTag(undefined, tagTemplate);
		}

		// Get commits from the previous tag to current version's tag
		const currentTag = tagStrategy === 'package'
			? `${packageName}@${version}`
			: typeof tagTemplate === 'string'
				? formatTag(tagTemplate, version)
				: `v${version}`;

		const commits = await getCommits(fromTag, currentTag);

		// Regenerate changelog for this version
		return generateChangelog(version, commits, packageName, githubOpts.changelog || {}, changelogPath);
	}

	return undefined;
}
