import type { PackageInfo, WorkspaceDetector } from './index.ts';
/**
 * Deno workspace detector
 */
import { extractPackageName, parseJsonc } from '@monup/utils';
import { fs, glob, path } from 'zx';
import { getJsrJson } from '../registries/jsr.ts';

interface DenoJson {
	name?: string;
	version?: string;
	workspace?: string[] | { packages?: string[] };
	[key: string]: unknown;
}

export class DenoWorkspaceDetector implements WorkspaceDetector {
	async canHandle(root: string): Promise<boolean> {
		const denoJsonPath = path.resolve(root, 'deno.json');
		if (!(await fs.exists(denoJsonPath))) {
			return false;
		}

		try {
			const content = await fs.readFile(denoJsonPath, 'utf-8');
			const config = parseJsonc<DenoJson>(content);
			return Array.isArray(config.workspace) || typeof config.workspace === 'object';
		}
		catch {
			return false;
		}
	}

	async detectPackages(root: string): Promise<PackageInfo[]> {
		const denoJsonPath = path.resolve(root, 'deno.json');
		const content = await fs.readFile(denoJsonPath, 'utf-8');
		const config = parseJsonc<DenoJson>(content);

		const workspaces = Array.isArray(config.workspace)
			? config.workspace
			: (typeof config.workspace === 'object' && config.workspace !== null && 'packages' in config.workspace && Array.isArray(config.workspace.packages))
					? config.workspace.packages
					: [];

		const packages: PackageInfo[] = [];

		for (const workspace of workspaces) {
			try {
				const matches = await glob(workspace, { cwd: root, onlyDirectories: true });
				for (const match of matches) {
					const packagePath = path.resolve(root, match);
					const denoJsonInfo = await this.getPackageInfo(packagePath, root);
					if (denoJsonInfo !== undefined) {
						packages.push(denoJsonInfo);
					}
				}
			}
			catch {
				// Silently handle errors
			}
		}

		return packages;
	}

	private async getPackageInfo(packagePath: string, root: string): Promise<PackageInfo | undefined> {
		// Check for deno.json
		const denoJsonInfo = await getDenoJson(packagePath, root);
		if (denoJsonInfo !== undefined) {
			return denoJsonInfo;
		}

		// A deno workspace package might have just a jsr.json file
		const jsrJsonInfo = await getJsrJson(packagePath, root);
		if (jsrJsonInfo !== undefined) {
			return jsrJsonInfo;
		}

		return undefined;
	}
}

export async function getDenoJson(packagePath: string, root: string): Promise<PackageInfo | undefined> {
	const denoJsonPath = path.resolve(packagePath, 'deno.json');
	if (await fs.exists(denoJsonPath)) {
		try {
			const content = await fs.readFile(denoJsonPath, 'utf-8');
			const config = parseJsonc<DenoJson>(content);
			return {
				name: extractPackageName(config.name, packagePath),
				path: packagePath,
				root,
				packageFile: denoJsonPath,
			};
		}
		catch {
			// Invalid deno.json
		}
	}
	return undefined;
}
