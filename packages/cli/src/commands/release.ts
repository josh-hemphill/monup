/**
 * Release command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { publishPackages } from '@monup/release';
import { detectPackages } from '@monup/workspace';
import { getCachedPackages, setCachedPackages } from '../cache.ts';
import { logger } from '../logger.ts';

/**
 * Handles the release command
 */
export async function handleRelease(
	options: ResolvedMonupOptions,
	dryRunOnly = false,
): Promise<void> {
	logger.debug('Handling release command', { dryRunOnly });
	// Use cached packages if available
	let packages = getCachedPackages();
	if (typeof packages === 'undefined') {
		packages = await detectPackages();
		setCachedPackages(packages);
	}

	if (packages.length === 0) {
		logger.error('No packages found in workspace');
		return;
	}

	await publishPackages(
		packages,
		{
			...options.release,
			isCI: options.isCI,
		},
		{
			dryRun: dryRunOnly,
			isCI: options.isCI,
		},
	);
}
