import type { PackageInfo } from '../plugins/index.ts';
import { fs, path } from 'zx';

export interface JsrJson {
	name?: string;
	version?: string;
	[key: string]: unknown;
}
export const JSR_JSON_FILES = ['jsr.json', 'jsr.jsonc'];
export async function getJsrJson(packagePath: string, root: string): Promise<PackageInfo | undefined> {
	for (const jsrJsonFile of JSR_JSON_FILES) {
		const jsrJsonPath = path.resolve(packagePath, jsrJsonFile);
		if (!(await fs.exists(jsrJsonPath))) {
			continue;
		}
		try {
			const content = await fs.readFile(jsrJsonPath, 'utf-8');
			const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
			const config = JSON.parse(jsonContent) as JsrJson;
			return {
				name: typeof config.name === 'string' ? config.name : packagePath,
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
