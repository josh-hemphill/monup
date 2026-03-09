import type { WorkingTreeChange } from '@monup/git';
import type { ResolvedMonupOptions } from '@monup/options';
/**
 * Release command handler
 */
import { cwd } from 'node:process';
import { getWorkingTreeStatus } from '@monup/git';
import { publishPackages } from '@monup/release';
import { detectPackages } from '@monup/workspace';
import { getCachedPackages, setCachedPackages } from '../cache.ts';
import { logger } from '../logger.ts';

function getChangePath(change: WorkingTreeChange): string {
	const renamedPaths = change.path.split(' -> ');
	return renamedPaths.at(-1) ?? change.path;
}

function isBinDirectoryPath(filePath: string): boolean {
	return /(?:^|\/)bin\//.test(filePath);
}

function hasOnlyBinDirectoryChanges(changes: WorkingTreeChange[]): boolean {
	return changes.length > 0 && changes.every((change) => isBinDirectoryPath(getChangePath(change)));
}

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

	const workspaceRoot = packages[0]?.root ?? cwd();
	let allowDirtyBinPaths = false;
	if (options.isCI) {
		const workingTreeStatus = await getWorkingTreeStatus(workspaceRoot);
		allowDirtyBinPaths = hasOnlyBinDirectoryChanges(workingTreeStatus.changes);
		if (workingTreeStatus.isClean) {
			logger.debug('Git working tree is clean before release', {
				root: workspaceRoot,
				branch: workingTreeStatus.branch,
			});
		}
		else if (allowDirtyBinPaths) {
			logger.warn('Allowing bin-only git working tree changes in CI release', {
				root: workspaceRoot,
				branch: workingTreeStatus.branch,
				changes: workingTreeStatus.changes.map((change: WorkingTreeChange) => change.raw),
			});
		}
		else {
			logger.error('Release blocked by unclean git working tree', {
				root: workspaceRoot,
				branch: workingTreeStatus.branch,
				changeCount: workingTreeStatus.changes.length,
				changes: workingTreeStatus.changes.map((change: WorkingTreeChange) => change.raw),
			});
			throw new Error('Release requires a clean git working tree');
		}
	}

	await publishPackages(
		packages,
		{
			...options.release,
			allowDirty: options.isCI && allowDirtyBinPaths,
			isCI: options.isCI,
		},
		{
			dryRun: dryRunOnly,
			isCI: options.isCI,
		},
	);
}
