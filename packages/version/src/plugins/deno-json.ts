import type { VersionUpdater } from './index.ts';
/**
 * Deno.json version updater plugin
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface DenoJson {
	name?: string;
	version?: string;
	[key: string]: unknown;
}

export class DenoJsonUpdater implements VersionUpdater {
	canHandle(filePath: string): boolean {
		return filePath.endsWith('deno.json') || filePath.endsWith('deno.jsonc');
	}

	async readVersion(filePath: string): Promise<string | undefined> {
		try {
			const content = await readFile(resolve(filePath), 'utf-8');
			// Handle JSONC (JSON with comments)
			const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
			const config = JSON.parse(jsonContent) as DenoJson;
			return typeof config.version === 'string' ? config.version : undefined;
		}
		catch {
			return undefined;
		}
	}

	async updateVersion(filePath: string, newVersion: string): Promise<void> {
		const content = await readFile(resolve(filePath), 'utf-8');
		// Simple regex replacement for version field
		const updated = content.replace(
			/("version"\s*:\s*")[^"]+(")/,
			`$1${newVersion}$2`,
		);
		await writeFile(resolve(filePath), updated, 'utf-8');
	}
}
