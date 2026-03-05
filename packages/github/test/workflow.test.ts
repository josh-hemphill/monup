import type { PackageInfo } from '@monup/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReleasesForPackages } from '../src/index.ts';

const { createReleaseMock, getCurrentVersionFromFileMock } = vi.hoisted(() => ({
	createReleaseMock: vi.fn(async() => undefined),
	getCurrentVersionFromFileMock: vi.fn(async() => '1.2.3'),
}));

vi.mock('../src/release.ts', async() => {
	const actual = await vi.importActual<typeof import('../src/release.ts')>('../src/release.ts');
	return {
		...actual,
		createRelease: createReleaseMock,
	};
});

vi.mock('@monup/version', () => ({
	getCurrentVersionFromFile: getCurrentVersionFromFileMock,
}));

describe('createReleasesForPackages', () => {
	beforeEach(() => {
		createReleaseMock.mockClear();
		getCurrentVersionFromFileMock.mockClear();
	});

	it('creates releases for packages with package files', async() => {
		const packages: PackageInfo[] = [
			{
				name: 'pkg1',
				path: '/workspace/packages/pkg1',
				root: '/workspace',
				packageFile: '/workspace/packages/pkg1/package.json',
			},
			{
				name: 'pkg2',
				path: '/workspace/packages/pkg2',
				root: '/workspace',
				packageFile: '/workspace/packages/pkg2/package.json',
			},
		];

		await createReleasesForPackages(packages, {
			github: { repo: 'owner/repo' },
			git: { tagStrategy: 'package', tagTemplate: 'v%s' },
			changelog: { strategy: 'per-package', location: 'CHANGELOG.md' },
		});

		expect(createReleaseMock).toHaveBeenCalledTimes(2);
		expect(createReleaseMock).toHaveBeenNthCalledWith(
			1,
			'1.2.3',
			'pkg1',
			'pkg1@1.2.3',
			expect.any(Object),
			expect.any(Object),
			'/workspace/packages/pkg1/CHANGELOG.md',
			packages,
		);
	});

	it('skips packages without package file', async() => {
		const packages: PackageInfo[] = [
			{
				name: 'pkg-no-file',
				path: '/workspace/pkg-no-file',
				root: '/workspace',
			},
		];

		await createReleasesForPackages(packages, {
			github: { repo: 'owner/repo' },
			git: { tagStrategy: 'global', tagTemplate: 'v%s' },
			changelog: { strategy: 'root', location: 'CHANGELOG.md' },
		});

		expect(createReleaseMock).not.toHaveBeenCalled();
	});
});
