import type { ResolvedMonupOptions } from '@monup/options';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	createReleasesForPackagesMock,
	publishPackagesMock,
	getPackagesWithCacheMock,
	getCachedPackagesMock,
} = vi.hoisted(() => ({
	createReleasesForPackagesMock: vi.fn(async () => undefined),
	publishPackagesMock: vi.fn(async () => undefined),
	getPackagesWithCacheMock: vi.fn(async () => ([
		{ name: 'pkg1', path: '/workspace/pkg1', root: '/workspace', packageFile: '/workspace/pkg1/package.json' },
	])),
	getCachedPackagesMock: vi.fn(() => ([
		{ name: 'pkg1', path: '/workspace/pkg1', root: '/workspace', packageFile: '/workspace/pkg1/package.json' },
	])),
}));

vi.mock('@monup/github', async () => {
	const actual = await vi.importActual<typeof import('@monup/github')>('@monup/github');
	return {
		...actual,
		createReleasesForPackages: createReleasesForPackagesMock,
	};
});

vi.mock('@monup/release', async () => {
	const actual = await vi.importActual<typeof import('@monup/release')>('@monup/release');
	return {
		...actual,
		publishPackages: publishPackagesMock,
	};
});

vi.mock('../src/package-utils.ts', () => ({
	getPackagesWithCache: getPackagesWithCacheMock,
}));

vi.mock('../src/cache.ts', async () => {
	const actual = await vi.importActual<typeof import('../src/cache.ts')>('../src/cache.ts');
	return {
		...actual,
		getCachedPackages: getCachedPackagesMock,
	};
});

import { handleGithub } from '../src/commands/github.ts';
import { handleRelease } from '../src/commands/release.ts';

const options: ResolvedMonupOptions = {
	changelog: {
		location: 'CHANGELOG.md',
		strategy: 'per-package',
		issueLinks: false,
		types: {},
		scopeMap: {},
		titles: {},
		contributors: true,
		capitalize: true,
		group: true,
		defaultVersion: '1.0.0',
		commitLinks: false,
		commitUrlTemplate: '',
		keepTypePrefix: false,
		resolvedCommitUrlTemplate: '',
		typeOrder: [],
	},
	version: {
		strategy: 'per-package',
		files: [],
		install: false,
		ignoreScripts: false,
	},
	git: {
		commit: true,
		push: true,
		tag: true,
		sign: false,
		noVerify: false,
		tagStrategy: 'package',
		tagTemplate: 'v%s',
		tagFilter: () => true,
		from: undefined,
		to: undefined,
	},
	github: {
		baseUrl: 'github.com',
		baseUrlApi: 'api.github.com',
		repo: 'owner/repo',
		releaseRepo: undefined,
		prerelease: undefined,
		changelogMethod: 'auto',
	},
	release: {
		dryRun: 'auto',
		commandPriority: ['pnpm', 'yarn', 'npm', 'deno'],
		excludedCommands: [],
		strict: true,
		detectionOrder: [
			'checkExplicitOverride',
			'checkWorkspaceContext',
			'checkJsrDenoPreference',
			'checkPackageManagerDetector',
			'checkCommandAvailability',
		],
		publishArgs: [],
		packageManager: undefined,
	},
	ci: { autoDetect: true },
	logLevel: { default: 'info', packages: {} },
	confirm: false,
	isCI: false,
};

describe('command delegation', () => {
	beforeEach(() => {
		createReleasesForPackagesMock.mockClear();
		publishPackagesMock.mockClear();
		getPackagesWithCacheMock.mockClear();
		getCachedPackagesMock.mockClear();
	});

	it('delegates github command to createReleasesForPackages', async () => {
		await handleGithub(options);
		expect(createReleasesForPackagesMock).toHaveBeenCalledTimes(1);
	});

	it('delegates release command to publishPackages', async () => {
		await handleRelease(options, true);
		expect(publishPackagesMock).toHaveBeenCalledTimes(1);
	});
});
