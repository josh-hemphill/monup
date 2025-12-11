import type { VersionUpdater } from './plugins/index.ts';
/**
 * Package file version updater
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { regex } from 'arkregex';

/**
 * Updates version in a package file
 */
export async function updateVersion(
	filePath: string,
	newVersion: string,
	updaters: VersionUpdater[],
): Promise<void> {
	const updater = updaters.find((u) => u.canHandle(filePath));
	if (typeof updater === 'undefined') {
		throw new TypeError(`No updater found for file: ${filePath}`);
	}

	await updater.updateVersion(filePath, newVersion);
}

/**
 * Updates version in additional files (e.g., README.md)
 * Uses simple string replacement
 */
export async function updateVersionInFiles(
	files: string[],
	oldVersion: string,
	newVersion: string,
): Promise<void> {
	for (const file of files) {
		try {
			const content = await readFile(resolve(file), 'utf-8');
			// Replace version patterns: v1.2.3, 1.2.3, version: "1.2.3", etc.
			const patterns = [
				regex(`\\bv${oldVersion.replace(/\./g, '\\.')}\\b`, 'g'),
				regex(`\\b${oldVersion.replace(/\./g, '\\.')}\\b`, 'g'),
			];

			let updated = content;
			for (const pattern of patterns) {
				updated = updated.replace(pattern, (match) => {
					return match.startsWith('v') ? `v${newVersion}` : newVersion;
				});
			}

			if (updated !== content) {
				await writeFile(resolve(file), updated, 'utf-8');
			}
		}
		catch {
			// Silently skip files that can't be read/updated
		}
	}
}
