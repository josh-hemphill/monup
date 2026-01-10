/**
 * GitHub command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { formatTag } from '@monup/git';
import { createRelease } from '@monup/github';
import { getCurrentVersionFromFile } from '@monup/version';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

/**
 * Handles the github command
 */
export async function handleGithub(options: ResolvedMonupOptions): Promise<void> {
	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}

	for (const pkg of packages) {
		if (typeof pkg.packageFile !== 'string') {
			continue;
		}

		const version = await getCurrentVersionFromFile(pkg.packageFile);
		if (typeof version !== 'string') {
			logger.warn(`No version found for ${pkg.name}, skipping`);
			continue;
		}

		const tagName = options.git.tagStrategy === 'package'
			? `${pkg.name}@${version}`
			: formatTag(options.git.tagTemplate, version);

		const changelogPath = options.changelog.strategy === 'per-package'
			? `${pkg.path}/${options.changelog.location}`
			: options.changelog.location;

		// Extract GitHub options with changelog dependency
		const githubOptions = {
			...options.github,
			changelog: options.changelog,
		};

		await createRelease(version, pkg.name, tagName, githubOptions, changelogPath);
	}
}
