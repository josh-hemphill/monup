import type { GitOptions, PackageInfo } from '@monup/git';
/**
 * Changelog extraction utilities for GitHub releases
 */
import type { GitHubOptionsWithDeps } from './options.ts';
import { extractChangelogForVersion, generateChangelog } from '@monup/changelog';
import { filterCommitsByPackage, formatTag, getCommits, getLastPackageTag, getLastTag, refExists } from '@monup/git';

/**
 * Extracts changelog for a version using markers or regeneration
 * Accepts GitHubOptionsWithDeps (includes partial changelog options)
 * If the release tag doesn't exist yet and packages are provided, falls back to
 * using commits from HEAD filtered by package to avoid duplicate changelogs.
 */
export async function extractChangelogForRelease(
	version: string,
	packageName: string,
	options: GitHubOptionsWithDeps,
	gitOptions: GitOptions,
	changelogPath?: string,
	packages?: PackageInfo[],
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

		// Build the current tag name
		const currentTag = tagStrategy === 'package'
			? `${packageName}@${version}`
			: typeof tagTemplate === 'string'
				? formatTag(tagTemplate, version)
				: `v${version}`;

		// Check if the release tag exists
		const tagExistsResult: boolean = await refExists(currentTag);

		if (tagExistsResult === true) {
			// Tag exists: use normal range (fromTag..currentTag)
			const commits = await getCommits(fromTag, currentTag);
			return generateChangelog(version, commits, packageName, githubOpts.changelog || {}, changelogPath);
		}

		// Tag doesn't exist yet (e.g. first release)
		// If packages provided, filter commits by package to avoid duplicates across packages
		if (Array.isArray(packages) && packages.length > 0) {
			// Get commits from previous tag to HEAD, with package info
			const allCommits = await getCommits(fromTag, undefined, packages);

			// Filter commits by package
			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(allCommits, packages);

			// Find the current package info
			const pkg = packages.find((p) => p.name === packageName);

			// Get commits for this package
			const scopedPackageCommits = scopedCommits.get(packageName) ?? [];

			// Root packages also get unscoped commits
			const isRootPackage = typeof pkg !== 'undefined' && (pkg.path === '.' || pkg.path === pkg.root);
			const commitsForThisPackage = isRootPackage
				? [...scopedPackageCommits, ...[...unscopedCommits]]
				: scopedPackageCommits;

			return generateChangelog(version, commitsForThisPackage, packageName, githubOpts.changelog || {}, changelogPath);
		}

		// No packages provided and tag doesn't exist: return undefined
		return undefined;
	}

	return undefined;
}
