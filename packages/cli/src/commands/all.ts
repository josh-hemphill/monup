/**
 * All command handler - runs complete workflow
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { logger } from '../logger.ts';
import { handleChangelog } from './changelog.ts';
import { handleGithub } from './github.ts';
import { handleRelease } from './release.ts';
import { handleVersion } from './version.ts';

/**
 * Handles the all command
 * Runs: version → changelog → release (dry-run by default) → github
 */
export async function handleAll(options: ResolvedMonupOptions): Promise<void> {
	logger.info('Running version update...');
	await handleVersion(options);

	logger.info('Generating changelog...');
	await handleChangelog(options);

	// Determine if we should dry-run release
	const shouldDryRun = options.release.dryRun === true
		|| (options.release.dryRun === 'auto' && !options.isCI);

	logger.info(shouldDryRun ? 'Running release dry-run...' : 'Publishing releases...');
	await handleRelease(options, shouldDryRun);

	logger.info('Creating GitHub releases...');
	await handleGithub(options);
}
