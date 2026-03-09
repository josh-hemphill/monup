import type { PackageInfo } from '@monup/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishPackages } from '../src/index.ts';

const { detectPackageManagerMock, executePublishMock } = vi.hoisted(() => ({
	detectPackageManagerMock: vi.fn(async() => ({ type: 'npm', command: 'pnpm' })),
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
});
