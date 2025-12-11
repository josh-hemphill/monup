/**
 * Release publishing logic
 */

import type { PackageInfo } from '@monup/workspace';
import type { ReleaseOptionsWithDeps } from './options.ts';
import packageJson from '../jsr.json' with { type: 'json' };
import { detectPackageManager } from './detector.ts';
import { executePublish } from './executor.ts';
import { resolveReleaseOptions } from './options.ts';

export const _VERSION: string = packageJson.version;
export { logger } from './logger.ts';

/**
 * Publishes a package
 * Accepts ReleaseOptionsWithDeps (includes isCI flag)
 */
export async function publish(
	pkg: PackageInfo,
	options: ReleaseOptionsWithDeps,
): Promise<void> {
	const resolvedOptions = resolveReleaseOptions(options);
	const isCI = options.isCI ?? false;

	// Determine if we should do a dry run
	const shouldDryRun = options.dryRun === true
		|| (options.dryRun === 'auto' && !isCI);

	// Actual publish
	const config = await detectPackageManager(pkg, resolvedOptions);
	await executePublish(pkg.path, config, shouldDryRun, resolvedOptions.publishArgs);
}

export type { ReleaseOptions, ReleaseOptionsWithDeps, ResolvedReleaseOptions } from './options.ts';
export { defaultReleaseOptions } from './options.ts';
