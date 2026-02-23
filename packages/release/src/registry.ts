/**
 * Registry query functions for listing published package versions
 */
import type { PackageInfo } from '@monup/workspace';
import type { PublishType } from './detector.ts';
import type { ResolvedReleaseOptions } from './options.ts';
import { getErrorMessage, parseJson, sortVersionsDescending } from '@monup/utils';
import { fs } from 'zx';
import { detectPackageManager } from './detector.ts';
import { logger } from './logger.ts';
import { spawnCommand } from './spawn.ts';

/**
 * Lists published versions for an npm package
 * @param packageName - Package name
 * @param options - Release options
 * @param registry - Optional npm registry URL
 * @param pkg - Package info for detecting package manager
 */
async function listNpmVersions(
	packageName: string,
	options: ResolvedReleaseOptions,
	registry?: string,
	pkg?: PackageInfo,
): Promise<string[]> {
	try {
		// Detect package manager to use appropriate command
		let command = 'npm';
		let viewCommand = 'view';

		if (typeof pkg !== 'undefined') {
			const detected = await detectPackageManager(pkg, options);
			if (typeof detected !== 'undefined') {
				command = detected.command.name;
				// Yarn uses different commands for viewing registry info
				if (command === 'yarn') {
					viewCommand = 'info';
				}
				logger.debug('Using detected package manager for registry query', { command });
			}
		}

		const args = [viewCommand, packageName, 'versions', '--json'];
		if (typeof registry === 'string') {
			args.push('--registry', registry);
		}

		const result = await spawnCommand(command, args, { capture: 'text' });
		const output = (typeof result === 'string' ? result : '').trim();

		if (output.length === 0) {
			logger.debug('No versions found for npm package', { packageName });
			return [];
		}

		// Parse JSON array of versions
		const versions = parseJson<unknown>(output);
		if (Array.isArray(versions)) {
			return versions.filter((v): v is string => typeof v === 'string');
		}

		logger.debug('Unexpected npm view output format', { packageName, output });
		return [];
	}
	catch (error: unknown) {
		logger.debug('Failed to list npm versions', {
			packageName,
			error: getErrorMessage(error),
		});
		return [];
	}
}

/**
 * Lists published versions for a JSR package
 * @param packageName - Package name (e.g., @scope/package)
 */
async function listJsrVersions(packageName: string): Promise<string[]> {
	try {
		// JSR API endpoint: https://jsr.io/@scope/package
		// We can query the API or use deno publish --dry-run to get version info
		// For now, let's try the API approach
		const apiUrl = `https://jsr.io/${packageName}`;
		const response = await fetch(apiUrl, {
			headers: {
				Accept: 'application/json',
			},
		});

		if (response.ok !== true) {
			logger.debug('JSR API request failed', { packageName, status: response.status });
			return [];
		}

		const data = await response.json() as {
			versions?: Array<{ version: string }>;
			[key: string]: unknown;
		};

		if (Array.isArray(data.versions)) {
			return data.versions
				.map((v) => v.version)
				.filter((v): v is string => typeof v === 'string');
		}

		logger.debug('Unexpected JSR API response format', { packageName });
		return [];
	}
	catch (error: unknown) {
		logger.debug('Failed to list JSR versions', {
			packageName,
			error: getErrorMessage(error),
		});
		return [];
	}
}

/**
 * Determines package name from package file
 */
async function getPackageName(pkg: PackageInfo): Promise<string | undefined> {
	if (typeof pkg.packageFile !== 'string') {
		return undefined;
	}

	try {
		const content = await fs.readFile(pkg.packageFile, 'utf-8');
		const json = parseJson<{ name?: string;[key: string]: unknown }>(content);

		if (typeof json.name === 'string') {
			return json.name;
		}
	}
	catch (error: unknown) {
		logger.debug('Failed to read package name', {
			packageFile: pkg.packageFile,
			error: getErrorMessage(error),
		});
	}

	return undefined;
}

/**
 * Lists published versions for a package from its registry
 * @param pkg - Package info
 * @param options - Release options
 * @returns Array of published version strings, sorted in descending order
 */
export async function listPublishedVersions(
	pkg: PackageInfo,
	options: ResolvedReleaseOptions,
): Promise<string[]> {
	const packageName = await getPackageName(pkg);
	if (typeof packageName !== 'string') {
		logger.debug('Cannot determine package name', { package: pkg.name });
		return [];
	}

	// Detect package type
	const publishType: PublishType | undefined = typeof pkg.packageFile === 'string'
		? pkg.packageFile.endsWith('package.json')
			? 'npm'
			: pkg.packageFile.endsWith('jsr.json')
				? 'jsr'
				: undefined
		: undefined;

	if (typeof publishType !== 'string') {
		logger.debug('Cannot determine package type', { package: pkg.name });
		return [];
	}

	logger.debug('Listing published versions', { packageName, publishType });

	let versions: string[] = [];
	if (publishType === 'npm') {
		versions = await listNpmVersions(packageName, options, undefined, pkg);
	}
	else if (publishType === 'jsr') {
		versions = await listJsrVersions(packageName);
	}

	const sorted = sortVersionsDescending(versions);

	logger.debug('Published versions retrieved', { packageName, count: sorted.length });
	return sorted;
}
