import type { PackageInfo } from '../plugins/index.ts';
import { extractPackageName, parseJsonc } from '@monup/utils';
import { fs, path } from 'zx';

export interface JsrJson {
	name?: string;
	version?: string;
	[key: string]: unknown;
}
export const JSR_JSON_FILES = ['jsr.json', 'jsr.jsonc'] as const;
export async function getJsrJson(packagePath: string, root: string): Promise<PackageInfo | undefined> {
	for (const jsrJsonFile of JSR_JSON_FILES) {
		const jsrJsonPath = path.resolve(packagePath, jsrJsonFile);
		if (!(await fs.exists(jsrJsonPath))) {
			continue;
		}
		try {
			const content = await fs.readFile(jsrJsonPath, 'utf-8');
			const config = parseJsonc<JsrJson>(content);
			return {
				name: extractPackageName(config.name, packagePath),
				path: packagePath,
				root,
				packageFile: jsrJsonPath,
			};
		}
		catch {
			// Invalid jsr.json
		}
	}

	return undefined;
}
