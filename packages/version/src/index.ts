import type { ParsedCommit } from '@monup/git';
import type { CommitTypeMapping } from './calculator.ts';
import packageJson from '../jsr.json' with { type: 'json' };
import { calculateBumpType, calculateNextVersion, getCurrentVersion } from './calculator.ts';
import { logger } from './logger.ts';
/**
 * Version calculation and updating
 */
import { DenoJsonUpdater } from './plugins/deno-json.ts';
import { getUpdaters, registerUpdater } from './plugins/index.ts';
import { JsrJsonUpdater } from './plugins/jsr-json.ts';
import { PackageJsonUpdater } from './plugins/package-json.ts';
import { updateVersion, updateVersionInFiles } from './updater.ts';

export const _VERSION: string = packageJson.version;
export { calculateBumpType, calculateNextVersion, type CommitTypeMapping, type VersionBumpType } from './calculator.ts';
export { logger } from './logger.ts';
export type { VersionOptions } from './options.ts';

// Register built-in updaters
registerUpdater(new PackageJsonUpdater());
registerUpdater(new DenoJsonUpdater());
registerUpdater(new JsrJsonUpdater());

/**
 * Calculates the next version based on commits
 */
export function calculateVersion(
	currentVersion: string,
	commits: ParsedCommit[],
	customTypeMapping?: CommitTypeMapping,
): {
	bumpType: 'major' | 'minor' | 'patch' | undefined;
	nextVersion: string | undefined;
} {
	logger.debug('Calculating version', { currentVersion, commitCount: commits.length, hasCustomMapping: typeof customTypeMapping !== 'undefined' });
	const bumpType = calculateBumpType(commits, customTypeMapping);
	logger.debug('Bump type determined', { bumpType });
	const nextVersion = bumpType ? calculateNextVersion(currentVersion, bumpType) : undefined;
	logger.debug('Next version calculated', { nextVersion, currentVersion });

	return {
		bumpType,
		nextVersion,
	};
}

/**
 * Gets the current version from a package file
 */
export async function getCurrentVersionFromFile(filePath: string): Promise<string | undefined> {
	logger.debug('Getting current version from file', { filePath });
	const updaters = getUpdaters();
	const version = await getCurrentVersion(filePath, updaters);
	logger.debug('Current version retrieved', { filePath, version });
	return version;
}

/**
 * Updates version in a package file
 */
export async function updateVersionInFile(
	filePath: string,
	newVersion: string,
): Promise<void> {
	logger.debug('Updating version in file', { filePath, newVersion });
	const updaters = getUpdaters();
	await updateVersion(filePath, newVersion, updaters);
	logger.debug('Version updated successfully', { filePath, newVersion });
}

/**
 * Updates version in additional files
 */
export async function updateVersionInAdditionalFiles(
	files: string[],
	oldVersion: string,
	newVersion: string,
): Promise<void> {
	logger.debug('Updating version in additional files', { fileCount: files.length, oldVersion, newVersion });
	logger.trace('Additional files', { files });
	await updateVersionInFiles(files, oldVersion, newVersion);
	logger.debug('Additional files updated successfully');
}

export { defaultVersionOptions } from './options.ts';
export { registerUpdater, type VersionUpdater } from './plugins/index.ts';
