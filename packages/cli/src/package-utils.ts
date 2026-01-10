/**
 * Package detection utilities with caching
 */
import type { PackageInfo } from '@monup/workspace';
import { detectPackages } from '@monup/workspace';
import { getCachedPackages, setCachedPackages } from './cache.ts';
import { logger } from './logger.ts';

/**
 * Gets workspace packages with caching
 * Detects packages if not cached, then caches the result
 * @returns Array of detected packages, or undefined if no packages found
 */
export async function getPackagesWithCache(): Promise<PackageInfo[] | undefined> {
	let packages = getCachedPackages();
	
	if (typeof packages === 'undefined') {
		packages = await detectPackages();
		setCachedPackages(packages);
	}

	if (packages.length === 0) {
		logger.error('No packages found in workspace');
		return undefined;
	}

	return packages;
}

