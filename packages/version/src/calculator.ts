import type { ParsedCommit } from '@monup/git';
import type { ReleaseType } from 'semver';
/**
 * Version calculation from conventional commits
 */
import { inc, valid } from 'semver';

export type VersionBumpType = 'major' | 'minor' | 'patch';

/**
 * Maps commit types to version bump types
 */
export interface CommitTypeMapping {
	[key: string]: VersionBumpType | undefined;
}

const defaultTypeMapping: CommitTypeMapping = {
	feat: 'minor',
	fix: 'patch',
	perf: 'patch',
	refactor: 'patch',
	docs: undefined,
	style: undefined,
	test: undefined,
	chore: undefined,
	build: undefined,
	ci: undefined,
};

/**
 * Determines version bump type from commits
 */
export function calculateBumpType(
	commits: ParsedCommit[],
	customMapping?: CommitTypeMapping,
): VersionBumpType | undefined {
	const mapping = { ...defaultTypeMapping, ...customMapping };
	let bumpType: VersionBumpType | undefined;

	for (const commit of commits) {
		// Breaking changes always trigger major bump
		if (commit.breaking) {
			return 'major';
		}

		// Check commit type
		if (typeof commit.type === 'string') {
			const mappedType = mapping[commit.type];
			if (typeof mappedType !== 'undefined') {
				// Major > minor > patch
				if (typeof bumpType === 'undefined' || bumpType === 'patch') {
					bumpType = mappedType;
				}
				if (mappedType === 'major') {
					return 'major';
				}
				if (mappedType === 'minor' && bumpType === 'patch') {
					bumpType = 'minor';
				}
			}
		}
	}

	return bumpType;
}

/**
 * Calculates the next version based on current version and bump type
 */
export function calculateNextVersion(
	currentVersion: string,
	bumpType: VersionBumpType | 'prerelease',
	prereleaseId?: string,
): string | undefined {
	const validVersion = valid(currentVersion);
	if (validVersion === null) {
		return undefined;
	}

	const releaseType: ReleaseType = bumpType === 'prerelease' ? 'prerelease' : bumpType;
	const result = typeof prereleaseId === 'string'
		? inc(validVersion, releaseType, prereleaseId)
		: inc(validVersion, releaseType);
	return result === null ? undefined : result;
}

/**
 * Gets the current version from a package file
 */
export async function getCurrentVersion(
	filePath: string,
	updaters: Array<{ canHandle: (path: string) => boolean; readVersion: (path: string) => Promise<string | undefined> }>,
): Promise<string | undefined> {
	const updater = updaters.find((u) => u.canHandle(filePath));
	if (typeof updater === 'undefined') {
		return undefined;
	}

	return updater.readVersion(filePath);
}
