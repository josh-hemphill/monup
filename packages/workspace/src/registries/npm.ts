import type { PackageInfo } from '../plugins/index.ts';
import { extractPackageName, parseJson } from '@monup/utils';
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
			const pkg = parseJson<NpmJson>(content);
			return {
				name: extractPackageName(pkg.name, packagePath),
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
