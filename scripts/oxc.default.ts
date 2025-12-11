import type { BundleEntry, TransformEntry } from 'obuild';
import { fileURLToPath } from 'node:url';
import { glob, path } from 'zx';

export function defaultTransformConfig(entry: Partial<TransformEntry> & Pick<TransformEntry, 'input'>): TransformEntry {
	return {
		...entry,
		type: 'transform',
		oxc: {
			...entry.oxc,
			sourcemap: true,
			target: 'esnext',
			typescript: {
				...entry.oxc?.typescript,
				declaration: {
					...entry.oxc?.typescript?.declaration,
					sourcemap: true,
				},
				rewriteImportExtensions: true,
				removeClassFieldsWithoutInitializer: true,
			},
			assumptions: {
				...entry.oxc?.assumptions,
				/* ignoreFunctionLength: true,
				objectRestNoSymbols: true, */
				noDocumentAll: true,
				pureGetters: true,
				setPublicClassFields: true,
			},
			define: {
				...entry.oxc?.define,
			},
		},
	};
}

export async function defaultBundleOxcConfig(entry: Partial<BundleEntry> & Pick<BundleEntry, 'input'>): Promise<BundleEntry>;
export async function defaultBundleOxcConfig(entry: Partial<BundleEntry>, allInGlob: string, cwd: string): Promise<BundleEntry>;
export async function defaultBundleOxcConfig(entry: Partial<BundleEntry> & Pick<BundleEntry, 'input'>, allInGlob?: string, meta_url?: string): Promise<BundleEntry> {
	if (typeof allInGlob === 'string' && typeof meta_url === 'string') {
		const cwd = path.dirname(fileURLToPath(meta_url));
		const allIn = await glob(allInGlob, { cwd });
		if (allIn.length > 0) {
			entry.input = allIn;
		}
		else {
			throw new Error(`No files found in ${allInGlob}`);
		}
	}
	return {
		...entry,
		type: 'bundle',
		dts: {
			...(typeof entry.dts === 'object' ? entry.dts : {}),
			sourcemap: true,
		},
		rolldown: {
			...entry.rolldown,
			platform: 'neutral',
			optimization: {
				inlineConst: true,
			},
		},
	};
};
