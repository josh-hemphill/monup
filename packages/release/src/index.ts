/**
 * Release publishing logic
 */

import type { PackageInfo } from '@monup/workspace';
import type { ReleaseOptionsWithDeps } from './options.ts';
import packageJson from '../package.json' with { type: 'json' };
import { detectPackageManager } from './detector.ts';
import { executePublish, executePublishRecursivePnpm } from './executor.ts';
import { resolveReleaseOptions } from './options.ts';

export const _VERSION: string = packageJson.version;
export type {
	JsrAuthorizationPermission,
	JsrAuthorizationResult,
	JsrAuthorizationSession,
} from './jsr-auth.ts';
export {
	createJsrAuthorization,
	JsrAuthorizationDeniedError,
	JsrAuthorizationTimeoutError,
	pollJsrAuthorization,
	resolveJsrSetupToken,
} from './jsr-auth.ts';
export type {
	JsrGitHubRepository,
	JsrPackageSettings,
	JsrPackageSetupResult,
	JsrReadmeSource,
	JsrRuntimeCompat,
	JsrSetupOptions,
} from './jsr-setup.ts';
export { setupJsrPackages } from './jsr-setup.ts';

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
	await executePublish(
		pkg.path,
		config,
		shouldDryRun,
		resolvedOptions.publishArgs,
		resolvedOptions.allowDirty,
		pkg.root,
	);
}

export interface PublishPackagesContext {
	dryRun?: boolean;
	isCI?: boolean;
}

/**
 * Creates one publish target per manifest file for a logical package.
 */
function getPublishTargets(pkg: PackageInfo): PackageInfo[] {
	const manifestPaths = pkg.packageFiles ?? (typeof pkg.packageFile === 'string' ? [pkg.packageFile] : []);
	const uniqueManifestPaths = [...new Set(manifestPaths)];
	if (uniqueManifestPaths.length === 0) {
		return [pkg];
	}

	return uniqueManifestPaths.map((packageFile) => ({
		...pkg,
		packageFile,
	}));
}

function isNpmTarget(target: PackageInfo): boolean {
	return typeof target.packageFile === 'string' && target.packageFile.endsWith('package.json');
}

/**
 * Publishes all packages with shared release context.
 * When all targets are npm and manager is pnpm, runs a single pnpm -r publish from root for one-time auth.
 */
export async function publishPackages(
	packages: PackageInfo[],
	options: ReleaseOptionsWithDeps,
	context: PublishPackagesContext = {},
): Promise<void> {
	const resolvedOptions = resolveReleaseOptions(options);
	const isCI = resolvedOptions.isCI ?? false;
	const shouldDryRun = resolvedOptions.dryRun === true
		|| (resolvedOptions.dryRun === 'auto' && !isCI);
	const mergedDryRun = context.dryRun === true ? true : shouldDryRun;

	const targets = packages.flatMap(getPublishTargets);
	const allNpmTargets = targets.filter(isNpmTarget);
	const useRecursivePnpm = allNpmTargets.length > 0
		&& allNpmTargets.length === targets.length;

	if (useRecursivePnpm) {
		const firstNpmTarget = allNpmTargets[0];
		if (firstNpmTarget === undefined) {
			throw new Error('Unexpected empty allNpmTargets');
		}
		const workspaceRoot = firstNpmTarget.root;
		const config = await detectPackageManager(firstNpmTarget, resolvedOptions);
		if (config.command.name === 'pnpm') {
			await executePublishRecursivePnpm(
				workspaceRoot,
				config,
				mergedDryRun,
				resolvedOptions.publishArgs,
				resolvedOptions.allowDirty,
			);
			return;
		}
	}

	for (const pkg of packages) {
		for (const publishTarget of getPublishTargets(pkg)) {
			const mergedOptions: ReleaseOptionsWithDeps = {
				...options,
				isCI: context.isCI ?? options.isCI,
			};

			if (context.dryRun === true) {
				mergedOptions.dryRun = true;
			}

			await publish(publishTarget, mergedOptions);
		}
	}
}

export { logger } from './logger.ts';
export type { ReleaseOptions, ReleaseOptionsWithDeps, ResolvedReleaseOptions } from './options.ts';
export { defaultReleaseOptions, resolveReleaseOptions } from './options.ts';
export { listPublishedVersions } from './registry.ts';
