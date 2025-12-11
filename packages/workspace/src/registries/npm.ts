import type { PackageInfo } from '../plugins/index.ts';
import { fs, path } from 'zx';

export interface NpmJson {
	name?: string;
	version?: string;
	workspaces?: string[] | { packages?: string[] };
	[key: string]: unknown;
}
export async function getNpmJson(packagePath: string, root: string): Promise<PackageInfo | undefined> {
	// Check for package.json
	const packageJsonPath = path.resolve(packagePath, 'package.json');
	if (await fs.exists(packageJsonPath)) {
		try {
			const content = await fs.readFile(packageJsonPath, 'utf-8');
			const pkg = JSON.parse(content) as NpmJson;
			return {
				name: typeof pkg.name === 'string' ? pkg.name : packagePath,
				path: packagePath,
				root,
				packageFile: packageJsonPath,
			};
		}
		catch {
			// Invalid package.json
		}
	}

	return undefined;
}
