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
export type { ReleaseOptions, ReleaseOptionsWithDeps, ResolvedReleaseOptions } from './options.ts';

/**
 * Publishes a package
 * Accepts ReleaseOptionsWithDeps (includes isCI flag)
 */
export async function publish(
	pkg: PackageInfo,
	options: ReleaseOptionsWithDeps,
): Promise<void> {
	const resolvedOptions = resolveReleaseOptions(options);
	const isCI = resolvedOptions.isCI ?? false;

	// Determine if we should do a dry run
	const shouldDryRun = resolvedOptions.dryRun === true
		|| (resolvedOptions.dryRun === 'auto' && !isCI);

	// Actual publish
	const config = await detectPackageManager(pkg, resolvedOptions);
	await executePublish(pkg.path, config, shouldDryRun, resolvedOptions.publishArgs);
}

export interface PublishPackagesContext {
	dryRun?: boolean;
	isCI?: boolean;
}

/**
 * Publishes all packages with shared release context.
 */
export async function publishPackages(
	packages: PackageInfo[],
	options: ReleaseOptionsWithDeps,
	context: PublishPackagesContext = {},
): Promise<void> {
	for (const pkg of packages) {
		const mergedOptions: ReleaseOptionsWithDeps = {
			...options,
			isCI: context.isCI ?? options.isCI,
		};

		if (context.dryRun === true) {
			mergedOptions.dryRun = true;
		}

		await publish(pkg, mergedOptions);
	}
}

export { defaultReleaseOptions, resolveReleaseOptions } from './options.ts';
export { listPublishedVersions } from './registry.ts';
