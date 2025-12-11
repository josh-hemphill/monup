import type { VersionUpdater } from './index.ts';
/**
 * Package.json version updater plugin
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface PackageJson {
	name?: string;
	version?: string;
	[key: string]: unknown;
}

export class PackageJsonUpdater implements VersionUpdater {
	canHandle(filePath: string): boolean {
		return filePath.endsWith('package.json');
	}

	async readVersion(filePath: string): Promise<string | undefined> {
		try {
			const content = await readFile(resolve(filePath), 'utf-8');
			const pkg = JSON.parse(content) as PackageJson;
			return typeof pkg.version === 'string' ? pkg.version : undefined;
		}
		catch {
			return undefined;
		}
	}

	async updateVersion(filePath: string, newVersion: string): Promise<void> {
		const content = await readFile(resolve(filePath), 'utf-8');
		const pkg = JSON.parse(content) as PackageJson;
		pkg.version = newVersion;
		await writeFile(resolve(filePath), `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
	}
}
