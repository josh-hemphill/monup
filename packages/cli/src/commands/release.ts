/**
 * Release command handler
 */
import type { ResolvedMonupOptions } from '@monup/options';
import { publish } from '@monup/release';
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

	for (const pkg of packages) {
		// Extract release options with isCI dependency
		const releaseOptions = {
			...options.release,
			isCI: options.isCI,
		};

		if (dryRunOnly) {
			releaseOptions.dryRun = true;
		}

		await publish(pkg, releaseOptions);
	}
}
