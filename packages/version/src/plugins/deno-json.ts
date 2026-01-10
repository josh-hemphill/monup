import type { VersionUpdater } from './index.ts';
/**
 * Deno.json version updater plugin
 */
import { resolve } from 'node:path';
import { parseJsonc, VERSION_FIELD_REGEX } from '@monup/utils';
import { fs } from 'zx';

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
			const content = await fs.readFile(resolve(filePath), 'utf-8');
			const config = parseJsonc<DenoJson>(content);
			return typeof config.version === 'string' ? config.version : undefined;
		}
		catch {
			return undefined;
		}
	}

	async updateVersion(filePath: string, newVersion: string): Promise<void> {
		const content = await fs.readFile(resolve(filePath), 'utf-8');
		const updated = content.replace(VERSION_FIELD_REGEX, `$1${newVersion}$2`);
		await fs.writeFile(resolve(filePath), updated, 'utf-8');
	}
}
