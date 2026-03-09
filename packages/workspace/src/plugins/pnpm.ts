import type { PackageInfo, WorkspaceDetector } from './index.ts';
/**
 * pnpm workspace detector
 */
import { fs, glob, path } from 'zx';
import { getJsrJson } from '../registries/jsr.ts';
import { getNpmJson } from '../registries/npm.ts';

const YAML_QUOTE_PATTERN = /['"]/g;

export class PnpmWorkspaceDetector implements WorkspaceDetector {
	async canHandle(root: string): Promise<boolean> {
		const workspaceFile = path.resolve(root, 'pnpm-workspace.yaml');
		return fs.exists(workspaceFile);
	}

	async detectPackages(root: string): Promise<PackageInfo[]> {
		const workspaceFile = path.resolve(root, 'pnpm-workspace.yaml');
		const content = await fs.readFile(workspaceFile, 'utf-8');

		// Parse pnpm-workspace.yaml
		// Format: packages: ['packages/*', 'apps/*']
		const packages: PackageInfo[] = [];
		const lines = content.split('\n');
		let inPackages = false;
		const patterns: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('packages:')) {
				inPackages = true;
				continue;
			}
			if (inPackages && trimmed.startsWith('-')) {
				const pattern = trimmed.slice(1).trim().replace(YAML_QUOTE_PATTERN, '');
				patterns.push(pattern);
			}
			if (inPackages
				&& typeof trimmed === 'string'
				&& trimmed.length > 0
				&& !trimmed.startsWith('-')
				&& !trimmed.startsWith('#')) {
				inPackages = false;
			}
		}

		// Find all package directories matching patterns
		for (const pattern of patterns) {
			const packageDirs = await this.findPackageDirs(root, pattern);
			packages.push(...packageDirs);
		}

		return packages;
	}

	private async findPackageDirs(root: string, pattern: string): Promise<PackageInfo[]> {
		const packages: PackageInfo[] = [];

		try {
			const matches = await glob(pattern, { cwd: root, onlyDirectories: true });
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

		return packages;
	}
}
