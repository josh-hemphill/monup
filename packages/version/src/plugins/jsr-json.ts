import type { VersionUpdater } from './index.ts';
/**
 * JSR.json version updater plugin
 */
import { resolve } from 'node:path';
import { parseJsonc, VERSION_FIELD_REGEX } from '@monup/utils';
import { fs } from 'zx';

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
			const content = await fs.readFile(resolve(filePath), 'utf-8');
			const config = parseJsonc<JsrJson>(content);
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
