/**
 * GitHub API client and release creation
 */
import type { GitOptions } from '@monup/git';
import type { ChangelogOptions } from '@monup/changelog';
import type { PackageInfo } from '@monup/workspace';
import { formatTag } from '@monup/git';
import { getCurrentVersionFromFile } from '@monup/version';
import packageJson from '../jsr.json' with { type: 'json' };
import { createRelease } from './release.ts';

export { extractChangelogForRelease } from './extractor.ts';
export { logger } from './logger.ts';
export type { GitHubOptions, GitHubOptionsWithDeps } from './options.ts';
export { defaultGitHubOptions } from './options.ts';
export type { GitHubRelease } from './release.ts';
export { createRelease, listReleases } from './release.ts';
export const _VERSION: string = packageJson.version;

export interface CreateReleasesOptions {
	github: import('./options.ts').GitHubOptionsWithDeps;
	git: GitOptions;
	changelog: Pick<ChangelogOptions, 'strategy' | 'location'>;
}

/**
 * Creates GitHub releases for all detected packages.
 */
export async function createReleasesForPackages(
	packages: PackageInfo[],
	options: CreateReleasesOptions,
): Promise<void> {
	for (const pkg of packages) {
		if (typeof pkg.packageFile !== 'string') {
			continue;
		}

		const version = await getCurrentVersionFromFile(pkg.packageFile);
		if (typeof version !== 'string') {
			continue;
		}

		const tagName = options.git.tagStrategy === 'package'
			? `${pkg.name}@${version}`
			: formatTag(options.git.tagTemplate ?? 'v%s', version);

		const changelogPath = options.changelog.strategy === 'per-package'
			? `${pkg.path}/${options.changelog.location ?? 'CHANGELOG.md'}`
			: options.changelog.location;

		await createRelease(
			version,
			pkg.name,
			tagName,
			{
				...options.github,
				changelog: options.changelog,
			},
			options.git,
			changelogPath,
			packages,
		);
	}
}
