import type { PackageInfo } from '@monup/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupJsrPackages } from '../src/index.ts';
import { logger } from '../src/logger.ts';

const packages: PackageInfo[] = [
	{
		name: 'test-jsr-package',
		path: '/workspace/jsr-package',
		root: '/workspace',
		packageFile: 'E:/Share/dev/monup/packages/release/test/fixtures/jsr-package/jsr.json',
	},
	{
		name: 'test-npm-package',
		path: '/workspace/npm-package',
		root: '/workspace',
		packageFile: 'E:/Share/dev/monup/packages/release/test/fixtures/npm-package/package.json',
	},
];

function createRemotePackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		scope: 'test',
		name: 'test-jsr-package',
		description: '',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		versionCount: 0,
		dependencyCount: 0,
		dependentCount: 0,
		isArchived: false,
		readmeSource: 'readme',
		...overrides,
	};
}

describe('setupJsrPackages', () => {
	const originalToken = process.env.JSR_TOKEN;
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		process.env.JSR_TOKEN = 'jsrw_test_token';
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		process.env.JSR_TOKEN = originalToken;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('creates missing packages and applies shared settings', async() => {
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'notFound', message: 'Package not found' }), { status: 404 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({ readmeSource: 'jsdoc' })), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Inferred package description',
				readmeSource: 'jsdoc',
			})), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Inferred package description',
				githubRepository: { owner: 'monup', name: 'monup' },
				readmeSource: 'jsdoc',
			})), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Inferred package description',
				githubRepository: { owner: 'monup', name: 'monup' },
				readmeSource: 'readme',
			})), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Inferred package description',
				githubRepository: { owner: 'monup', name: 'monup' },
				readmeSource: 'readme',
				runtimeCompat: { node: true, deno: false },
			})), { status: 200 }));

		const results = await setupJsrPackages(packages, {
			description: 'Inferred package description',
			githubRepository: { owner: 'monup', name: 'monup' },
			readmeSource: 'readme',
			runtimeCompat: { node: true, deno: false },
		});

		expect(results).toEqual([
			{
				packageName: '@test/test-jsr-package',
				created: true,
				updatedFields: ['description', 'githubRepository', 'readmeSource', 'runtimeCompat'],
				warnings: [],
			},
		]);
		expect(fetchMock).toHaveBeenCalledTimes(6);

		const createCall = fetchMock.mock.calls[1];
		expect(createCall?.[0]).toBe('https://api.jsr.io/scopes/test/packages');
		expect(createCall?.[1]).toMatchObject({
			method: 'POST',
			body: JSON.stringify({ package: 'test-jsr-package' }),
		});
		expect(createCall?.[1]?.headers).toMatchObject({
			Authorization: 'Bearer jsrw_test_token',
		});
	});

	it('warns and continues when packages already exist', async() => {
		const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
			githubRepository: { owner: 'monup', name: 'monup' },
			readmeSource: 'readme',
			runtimeCompat: { node: true, deno: false },
		})), { status: 200 }));

		const results = await setupJsrPackages(packages, {
			githubRepository: { owner: 'monup', name: 'monup' },
			readmeSource: 'readme',
			runtimeCompat: { node: true, deno: false },
		});

		expect(results).toEqual([
			{
				packageName: '@test/test-jsr-package',
				created: false,
				updatedFields: [],
				warnings: ['JSR package already exists: @test/test-jsr-package'],
			},
		]);
		expect(warnSpy).toHaveBeenCalledWith('JSR package already exists: @test/test-jsr-package');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('applies package-specific overrides on top of shared settings', async() => {
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage()), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Per-package description',
			})), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Per-package description',
				githubRepository: { owner: 'monup', name: 'monup' },
			})), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				description: 'Per-package description',
				githubRepository: { owner: 'monup', name: 'monup' },
				runtimeCompat: { node: true, deno: false },
			})), { status: 200 }));

		const results = await setupJsrPackages(packages, {
			githubRepository: { owner: 'monup', name: 'monup' },
			runtimeCompat: { node: true },
			packageOverrides: {
				'@test/test-jsr-package': {
					description: 'Per-package description',
					runtimeCompat: { deno: false },
				},
			},
		});

		expect(results).toEqual([
			{
				packageName: '@test/test-jsr-package',
				created: false,
				updatedFields: ['description', 'githubRepository', 'runtimeCompat'],
				warnings: ['JSR package already exists: @test/test-jsr-package'],
			},
		]);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
			method: 'PATCH',
			body: JSON.stringify({
				runtimeCompat: {
					node: true,
					deno: false,
				},
			}),
		});
	});

	it('warns and continues when a create race reports an existing package', async() => {
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'notFound', message: 'Package not found' }), { status: 404 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'alreadyExists', message: 'Package already exists' }), { status: 400 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage()), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(createRemotePackage({
				githubRepository: { owner: 'monup', name: 'monup' },
			})), { status: 200 }));

		const results = await setupJsrPackages(packages, {
			githubRepository: { owner: 'monup', name: 'monup' },
		});

		expect(results).toEqual([
			{
				packageName: '@test/test-jsr-package',
				created: false,
				updatedFields: ['githubRepository'],
				warnings: ['JSR package already exists: @test/test-jsr-package'],
			},
		]);
	});

	it('fails fast when the JSR token is missing', async() => {
		delete process.env.JSR_TOKEN;

		await expect(setupJsrPackages(packages, {
			githubRepository: { owner: 'monup', name: 'monup' },
		})).rejects.toThrow('JSR setup requires the JSR_TOKEN environment variable.');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
