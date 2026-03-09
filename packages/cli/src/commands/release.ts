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

	if (options.isCI) {
		const workspaceRoot = packages[0]?.root ?? cwd();
		const workingTreeStatus = await getWorkingTreeStatus(workspaceRoot);
		if (workingTreeStatus.isClean) {
			logger.debug('Git working tree is clean before release', {
				root: workspaceRoot,
				branch: workingTreeStatus.branch,
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
			isCI: options.isCI,
		},
		{
			dryRun: dryRunOnly,
			isCI: options.isCI,
		},
	);
}
