import type { PackageInfo } from '@monup/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishPackages } from '../src/index.ts';

const { detectPackageManagerMock, executePublishMock, executePublishRecursivePnpmMock } = vi.hoisted(() => ({
	detectPackageManagerMock: vi.fn(async(pkg: PackageInfo) => ({
		publishType: pkg.packageFile?.endsWith('jsr.json') ? 'jsr' : 'npm',
		command: {
			name: pkg.packageFile?.endsWith('jsr.json') ? 'deno' : 'pnpm',
		},
	})),
	executePublishMock: vi.fn(async() => undefined),
	executePublishRecursivePnpmMock: vi.fn(async() => undefined),
}));

vi.mock('../src/detector.ts', async() => {
	const actual = await vi.importActual<typeof import('../src/detector.ts')>('../src/detector.ts');
	return {
		...actual,
		detectPackageManager: detectPackageManagerMock,
	};
});

vi.mock('../src/executor.ts', async() => {
	const actual = await vi.importActual<typeof import('../src/executor.ts')>('../src/executor.ts');
	return {
		...actual,
		executePublish: executePublishMock,
		executePublishRecursivePnpm: executePublishRecursivePnpmMock,
	};
});

describe('publishPackages', () => {
	const packages: PackageInfo[] = [
		{ name: 'pkg1', path: '/workspace/pkg1', root: '/workspace', packageFile: '/workspace/pkg1/package.json' },
		{ name: 'pkg2', path: '/workspace/pkg2', root: '/workspace', packageFile: '/workspace/pkg2/package.json' },
	];

	beforeEach(() => {
		detectPackageManagerMock.mockClear();
		executePublishMock.mockClear();
		executePublishRecursivePnpmMock.mockClear();
	});

	it('runs single pnpm -r publish when all targets are npm and manager is pnpm', async() => {
		await publishPackages(
			packages,
			{ dryRun: 'auto', isCI: false, allowDirty: true },
			{ isCI: true, dryRun: true },
		);

		expect(detectPackageManagerMock).toHaveBeenCalledTimes(1);
		expect(executePublishRecursivePnpmMock).toHaveBeenCalledTimes(1);
		expect(executePublishRecursivePnpmMock).toHaveBeenCalledWith(
			'/workspace',
			expect.objectContaining({ publishType: 'npm', command: { name: 'pnpm' } }),
			true,
			[],
			true,
		);
		expect(executePublishMock).not.toHaveBeenCalled();
	});

	it('publishes each manifest per target when mixed npm and JSR', async() => {
		await publishPackages(
			[
				{
					name: 'pkg1',
					path: '/workspace/pkg1',
					root: '/workspace',
					packageFile: '/workspace/pkg1/package.json',
					packageFiles: [
						'/workspace/pkg1/package.json',
						'/workspace/pkg1/jsr.json',
					],
				},
			],
			{ dryRun: 'auto', isCI: false },
			{ isCI: true, dryRun: true },
		);

		expect(detectPackageManagerMock).toHaveBeenCalledTimes(2);
		expect(detectPackageManagerMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ packageFile: '/workspace/pkg1/package.json' }),
			expect.any(Object),
		);
		expect(detectPackageManagerMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ packageFile: '/workspace/pkg1/jsr.json' }),
			expect.any(Object),
		);
		expect(executePublishMock).toHaveBeenCalledTimes(2);
		expect(executePublishMock).toHaveBeenNthCalledWith(
			1,
			'/workspace/pkg1',
			{ publishType: 'npm', command: { name: 'pnpm' } },
			true,
			[],
			false,
			'/workspace',
		);
		expect(executePublishMock).toHaveBeenNthCalledWith(
			2,
			'/workspace/pkg1',
			{ publishType: 'jsr', command: { name: 'deno' } },
			true,
			[],
			false,
			'/workspace',
		);
		expect(executePublishRecursivePnpmMock).not.toHaveBeenCalled();
	});
});
