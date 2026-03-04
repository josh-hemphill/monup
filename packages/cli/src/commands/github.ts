/**
 * GitHub command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { createReleasesForPackages } from '@monup/github';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

/**
 * Handles the github command
 */
export async function handleGithub(options: ResolvedMonupOptions): Promise<void> {
	logger.debug('Handling github command');
	logger.trace('GitHub options', options.github);
	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}

	await createReleasesForPackages(packages, {
		github: options.github,
		git: options.git,
		changelog: options.changelog,
	});
}
