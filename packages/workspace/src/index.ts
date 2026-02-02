import type { PackageInfo } from './plugins/index.ts';
/**
 * Workspace package detection and management
 */
import { cwd } from 'node:process';
import { updateVersionInFile } from '@monup/version';
import { fs } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { logger } from './logger.ts';
import { DenoWorkspaceDetector, getDenoJson } from './plugins/deno.ts';
import { getHandlers, registerDetector } from './plugins/index.ts';
import { NpmWorkspaceDetector } from './plugins/npm.ts';

import { PnpmWorkspaceDetector } from './plugins/pnpm.ts';
import { getJsrJson } from './registries/jsr.ts';
import { getNpmJson } from './registries/npm.ts';

export const _VERSION: string = packageJson.version;

// Register built-in detectors
registerDetector(new PnpmWorkspaceDetector());
registerDetector(new NpmWorkspaceDetector());
registerDetector(new DenoWorkspaceDetector());

export { logger } from './logger.ts';

/**
 * Detects packages in a workspace
 */
export async function detectPackages(root: string = cwd()): Promise<PackageInfo[]> {
	logger.debug('Detecting packages', { root });
	const handlers = await getHandlers(root);
	if (handlers.length === 0) {
		logger.debug('No workspace detector found, trying root as single package');
		// If no detector found, try to detect root as a single package
		return detectRootAsPackage(root);
	}

	const packages: PackageInfo[] = [];
	for (const handler of handlers) {
		const packages = await handler.detectPackages(root);
		logger.debug(`${handler.constructor.name} detected ${packages.length} packages`);
		logger.trace(`${handler.constructor.name} detected ${packages.map((p) => [p.name, p.path].join(': ')).join(', ')}`);
		packages.push(...packages);
	}

	return packages;
}

async function detectRootAsPackage(root: string): Promise<PackageInfo[]> {
	logger.trace('Detecting root as single package', { root });
	const packages: PackageInfo[] = [];

	const maybeJsrJson = await getJsrJson(root, root);
	if (maybeJsrJson !== undefined) {
		logger.debug('Root package detected as jsr.json member', { name: maybeJsrJson.name });
		packages.push(maybeJsrJson);
	}

	// Check for package.json
	const packageJson = await getNpmJson(root, root);
	if (packageJson !== undefined) {
		logger.debug('Root package detected from package.json', { name: packageJson.name });
		packages.push(packageJson);
	}
	// Check for deno.json
	const denoJson = await getDenoJson(root, root);
	if (denoJson !== undefined) {
		logger.debug('Root package detected from deno.json', { name: denoJson.name });
		packages.push(denoJson);
	}

	if (packages.length === 0) {
		logger.debug('No root package detected');
	}

	return packages;
}

/**
 * Gets package info for a specific package
 */
export async function getPackageInfo(
	packageName: string,
	root: string = cwd(),
): Promise<PackageInfo | undefined> {
	const packages = await detectPackages(root);
	return packages.find((pkg) => pkg.name === packageName);
}

/**
 * Updates versions across packages
 */
export async function updatePackageVersions(
	packages: PackageInfo[],
	versionMap: Map<string, string>,
): Promise<void> {
	for (const pkg of packages) {
		const newVersion = versionMap.get(pkg.name);
		if (typeof newVersion === 'string' && typeof pkg.packageFile === 'string') {
			await updateVersionInFile(pkg.packageFile, newVersion);
		}
	}
}

export { type PackageInfo, registerDetector, type WorkspaceDetector } from './plugins/index.ts';
