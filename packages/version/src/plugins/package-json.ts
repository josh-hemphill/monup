import type { VersionUpdater } from './index.ts';
/**
 * Package.json version updater plugin
 */
import { parseJson } from '@monup/utils';
import { resolve } from 'node:path';
import { fs } from 'zx';

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
			const content = await fs.readFile(resolve(filePath), 'utf-8');
			const pkg = parseJson<PackageJson>(content);
			return typeof pkg.version === 'string' ? pkg.version : undefined;
		}
		catch {
			return undefined;
		}
	}

	async updateVersion(filePath: string, newVersion: string): Promise<void> {
		const content = await fs.readFile(resolve(filePath), 'utf-8');
		const pkg = parseJson<PackageJson>(content);
		pkg.version = newVersion;
		await fs.writeFile(resolve(filePath), `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
	}
}
