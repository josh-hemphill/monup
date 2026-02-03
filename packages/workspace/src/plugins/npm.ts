import type { NpmJson } from '../registries/npm.ts';
import type { PackageInfo, WorkspaceDetector } from './index.ts';
import { parseJson } from '@monup/utils';
import { fs, glob, path } from 'zx';
import { getJsrJson } from '../registries/jsr.ts';
import { getNpmJson } from '../registries/npm.ts';

export class NpmWorkspaceDetector implements WorkspaceDetector {
	async canHandle(root: string): Promise<boolean> {
		const packageJsonPath = path.resolve(root, 'package.json');
		if (!(await fs.exists(packageJsonPath))) {
			return false;
		}

		try {
			const content = await fs.readFile(packageJsonPath, 'utf-8');
			const pkg = parseJson<NpmJson>(content);
			return Array.isArray(pkg.workspaces) || typeof pkg.workspaces === 'object';
		}
		catch {
			return false;
		}
	}

	async detectPackages(root: string): Promise<PackageInfo[]> {
		const packageJsonPath = path.resolve(root, 'package.json');
		const content = await fs.readFile(packageJsonPath, 'utf-8');
		const pkg = parseJson<NpmJson>(content);

		const workspaces = Array.isArray(pkg.workspaces)
			? pkg.workspaces
			: (typeof pkg.workspaces === 'object' && pkg.workspaces !== null && 'packages' in pkg.workspaces && Array.isArray(pkg.workspaces.packages))
				? pkg.workspaces.packages
				: [];

		const packages: PackageInfo[] = [];

		for (const workspace of workspaces) {
			try {
				const matches = await glob(workspace, { cwd: root, onlyDirectories: true });
				for (const match of matches) {
					const packagePath = path.resolve(root, match);
					const packageInfo = await getNpmJson(packagePath, root);
					if (packageInfo !== undefined) {
						packages.push(packageInfo);
					}
					const jsrJsonInfo = await getJsrJson(packagePath, root);
					if (jsrJsonInfo !== undefined) {
						packages.push(jsrJsonInfo);
					}
				}
			}
			catch {
				// Silently handle errors
			}
		}

		return packages;
	}
}
