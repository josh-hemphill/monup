import type { VersionUpdater } from './index.ts';
/**
 * JSR.json version updater plugin
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface JsrJson {
	name?: string;
	version?: string;
	[key: string]: unknown;
}

export class JsrJsonUpdater implements VersionUpdater {
	canHandle(filePath: string): boolean {
		return filePath.endsWith('jsr.json') || filePath.endsWith('jsr.jsonc');
	}

	async readVersion(filePath: string): Promise<string | undefined> {
		try {
			const content = await readFile(resolve(filePath), 'utf-8');
			// Handle JSONC (JSON with comments)
			const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
			const config = JSON.parse(jsonContent) as JsrJson;
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
