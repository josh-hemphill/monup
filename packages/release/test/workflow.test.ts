import type { PackageInfo } from '@monup/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishPackages } from '../src/index.ts';

const { detectPackageManagerMock, executePublishMock } = vi.hoisted(() => ({
	detectPackageManagerMock: vi.fn(async(pkg: PackageInfo) => ({
		publishType: pkg.packageFile?.endsWith('jsr.json') ? 'jsr' : 'npm',
		command: {
			name: pkg.packageFile?.endsWith('jsr.json') ? 'deno' : 'pnpm',
		},
	})),
	executePublishMock: vi.fn(async() => undefined),
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
	});

	it('publishes all packages with merged context', async() => {
		await publishPackages(
			packages,
			{ dryRun: 'auto', isCI: false, allowDirty: true },
			{ isCI: true, dryRun: true },
		);

		expect(detectPackageManagerMock).toHaveBeenCalledTimes(2);
		expect(executePublishMock).toHaveBeenCalledTimes(2);
		expect(executePublishMock).toHaveBeenNthCalledWith(1, '/workspace/pkg1', expect.any(Object), true, [], true);
		expect(executePublishMock).toHaveBeenNthCalledWith(2, '/workspace/pkg2', expect.any(Object), true, [], true);
	});

	it('publishes each manifest for packages with packageFiles', async() => {
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
			expect.objectContaining({ publishType: 'npm', command: expect.objectContaining({ name: 'pnpm' }) }),
			true,
			[],
			false,
		);
		expect(executePublishMock).toHaveBeenNthCalledWith(
			2,
			'/workspace/pkg1',
			expect.objectContaining({ publishType: 'jsr', command: expect.objectContaining({ name: 'deno' }) }),
			true,
			[],
			false,
		);
	});
});
