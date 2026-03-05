import type { PackageInfo } from './plugins/index.ts';
/**
 * Workspace package detection and management
 */
import { cwd } from 'node:process';
import { updateVersionInFile } from '@monup/version';
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

/** Picks canonical manifest for reading version: package.json > jsr.json/jsr.jsonc > deno.json > first */
function pickCanonicalManifest(paths: string[]): string {
	const byPreference = (p: string): number => {
		if (p.endsWith('package.json'))
			return 0;
		if (p.includes('jsr.json'))
			return 1;
		if (p.endsWith('deno.json'))
			return 2;
		return 3;
	};
	const sorted = [...paths].sort((a, b) => byPreference(a) - byPreference(b));
	return sorted[0] ?? '';
}

/** Merges multiple manifest entries for the same path into one logical package with all manifest paths. */
function mergePackagesByPath(raw: PackageInfo[]): PackageInfo[] {
	const byPath = new Map<string, PackageInfo[]>();
	for (const pkg of raw) {
		const key = pkg.path;
		const list = byPath.get(key) ?? [];
		list.push(pkg);
		byPath.set(key, list);
	}
	const result: PackageInfo[] = [];
	for (const [, group] of byPath) {
		const manifestPaths = [...new Set(
			group.map((p) => p.packageFile).filter((f): f is string => typeof f === 'string'),
		)];
		if (manifestPaths.length === 0) {
			const first = group[0];
			if (first !== undefined)
				result.push(first);
			continue;
		}
		const canonical = pickCanonicalManifest(manifestPaths);
		const canonicalEntry = group.find((p) => p.packageFile === canonical) ?? group[0];
		if (canonicalEntry === undefined)
			continue;
		result.push({
			name: canonicalEntry.name,
			path: canonicalEntry.path,
			root: canonicalEntry.root,
			packageFile: canonical,
			packageFiles: manifestPaths.length > 1 ? manifestPaths.sort() : undefined,
		});
	}
	return result;
}

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
		const detected = await handler.detectPackages(root);
		logger.debug(`${handler.constructor.name} detected ${detected.length} packages`);
		logger.trace(`${handler.constructor.name} detected ${detected.map((p) => [p.name, p.path].join(': ')).join(', ')}`);
		packages.push(...detected);
	}

	return mergePackagesByPath(packages);
}

async function detectRootAsPackage(root: string): Promise<PackageInfo[]> {
	logger.trace('Detecting root as single package', { root });
	const packages: PackageInfo[] = [];

	// Check for package.json first
	const packageJson = await getNpmJson(root, root);
	if (packageJson !== undefined) {
		logger.debug('Root package detected from package.json', { name: packageJson.name });
		packages.push(packageJson);
	}

	// Check for jsr.json
	const maybeJsrJson = await getJsrJson(root, root);
	if (maybeJsrJson !== undefined) {
		logger.debug('Root package detected as jsr.json member', { name: maybeJsrJson.name });
		packages.push(maybeJsrJson);
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

	return mergePackagesByPath(packages);
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
		if (typeof newVersion !== 'string')
			continue;
		const files = pkg.packageFiles ?? (typeof pkg.packageFile === 'string' ? [pkg.packageFile] : []);
		for (const file of files) {
			await updateVersionInFile(file, newVersion);
		}
	}
}

export { type PackageInfo, registerDetector, type WorkspaceDetector } from './plugins/index.ts';
