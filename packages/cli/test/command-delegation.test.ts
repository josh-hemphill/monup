import type { ResolvedMonupOptions } from '@monup/options';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleChangelog } from '../src/commands/changelog.ts';

import { handleGithub } from '../src/commands/github.ts';
import { handleRelease } from '../src/commands/release.ts';

const {
	getCommitsMock,
	getFirstCommitMock,
	getWorkingTreeStatusMock,
	runChangelogMock,
	createReleasesForPackagesMock,
	publishPackagesMock,
	getPackagesWithCacheMock,
	getCachedPackagesMock,
	getCachedCommitsMock,
	setCachedCommitsMock,
} = vi.hoisted(() => ({
	getCommitsMock: vi.fn(async() => []),
	getFirstCommitMock: vi.fn(async() => 'first-hash'),
	getWorkingTreeStatusMock: vi.fn(async() => ({
		branch: 'main',
		changes: [],
		isClean: true,
	})),
	runChangelogMock: vi.fn(async() => undefined),
	createReleasesForPackagesMock: vi.fn(async() => undefined),
	publishPackagesMock: vi.fn(async() => undefined),
	getPackagesWithCacheMock: vi.fn(async() => ([
		{ name: 'pkg1', path: '/workspace/pkg1', root: '/workspace', packageFile: '/workspace/pkg1/package.json' },
	])),
	getCachedPackagesMock: vi.fn(() => ([
		{ name: 'pkg1', path: '/workspace/pkg1', root: '/workspace', packageFile: '/workspace/pkg1/package.json' },
	])),
	getCachedCommitsMock: vi.fn(() => undefined),
	setCachedCommitsMock: vi.fn(),
}));

vi.mock('@monup/git', async() => {
	const actual = await vi.importActual<typeof import('@monup/git')>('@monup/git');
	return {
		...actual,
		getCommits: getCommitsMock,
		getFirstCommit: getFirstCommitMock,
		getWorkingTreeStatus: getWorkingTreeStatusMock,
	};
});

vi.mock('@monup/changelog', async() => {
	const actual = await vi.importActual<typeof import('@monup/changelog')>('@monup/changelog');
	return {
		...actual,
		runChangelog: runChangelogMock,
	};
});

vi.mock('@monup/github', async() => {
	const actual = await vi.importActual<typeof import('@monup/github')>('@monup/github');
	return {
		...actual,
		createReleasesForPackages: createReleasesForPackagesMock,
	};
});

vi.mock('@monup/release', async() => {
	const actual = await vi.importActual<typeof import('@monup/release')>('@monup/release');
	return {
		...actual,
		publishPackages: publishPackagesMock,
	};
});

vi.mock('../src/package-utils.ts', () => ({
	getPackagesWithCache: getPackagesWithCacheMock,
}));

vi.mock('../src/cache.ts', async() => {
	const actual = await vi.importActual<typeof import('../src/cache.ts')>('../src/cache.ts');
	return {
		...actual,
		getCachedPackages: getCachedPackagesMock,
		getCachedCommits: getCachedCommitsMock,
		setCachedCommits: setCachedCommitsMock,
	};
});

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
		allowDirty: false,
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
		getCommitsMock.mockClear();
		getFirstCommitMock.mockClear();
		getWorkingTreeStatusMock.mockClear();
		getWorkingTreeStatusMock.mockResolvedValue({
			branch: 'main',
			changes: [],
			isClean: true,
		});
		runChangelogMock.mockClear();
		createReleasesForPackagesMock.mockClear();
		publishPackagesMock.mockClear();
		getPackagesWithCacheMock.mockClear();
		getCachedPackagesMock.mockClear();
		getCachedCommitsMock.mockClear();
		setCachedCommitsMock.mockClear();
	});

	it('delegates changelog command using explicit git.from/git.to range', async() => {
		await handleChangelog({
			...options,
			git: {
				...options.git,
				from: 'v1.0.0',
				to: 'HEAD',
			},
		});

		expect(getFirstCommitMock).not.toHaveBeenCalled();
		expect(getCommitsMock).toHaveBeenCalledWith(
			'v1.0.0',
			'HEAD',
			expect.any(Array),
			'/workspace',
		);
		expect(runChangelogMock).toHaveBeenCalledTimes(1);
	});

	it('delegates changelog command using first commit..HEAD fallback when range is not set', async() => {
		getFirstCommitMock.mockResolvedValueOnce('abc123');

		await handleChangelog({
			...options,
			git: {
				...options.git,
				from: undefined,
				to: undefined,
			},
		});

		expect(getFirstCommitMock).toHaveBeenCalledWith('/workspace');
		expect(getCommitsMock).toHaveBeenCalledWith(
			'abc123',
			'HEAD',
			expect.any(Array),
			'/workspace',
		);
		expect(runChangelogMock).toHaveBeenCalledTimes(1);
	});

	it('delegates github command to createReleasesForPackages', async() => {
		await handleGithub(options);
		expect(createReleasesForPackagesMock).toHaveBeenCalledTimes(1);
	});

	it('delegates release command to publishPackages', async() => {
		await handleRelease(options, true);
		expect(getWorkingTreeStatusMock).not.toHaveBeenCalled();
		expect(publishPackagesMock).toHaveBeenCalledTimes(1);
		expect(publishPackagesMock).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ allowDirty: false }),
			expect.any(Object),
		);
	});

	it('checks git working tree in CI before publishing', async() => {
		await handleRelease({ ...options, isCI: true }, false);
		expect(getWorkingTreeStatusMock).toHaveBeenCalledWith('/workspace');
		expect(publishPackagesMock).toHaveBeenCalledTimes(1);
		expect(publishPackagesMock).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ allowDirty: false }),
			expect.any(Object),
		);
	});

	it('allows bin-only git working tree changes in CI', async() => {
		getWorkingTreeStatusMock.mockResolvedValueOnce({
			branch: 'main',
			changes: [{ indexStatus: 'M', workingTreeStatus: ' ', path: 'packages/cli/bin/monup.mjs', raw: 'M  packages/cli/bin/monup.mjs' }],
			isClean: false,
		});

		await handleRelease({ ...options, isCI: true }, false);

		expect(publishPackagesMock).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ allowDirty: true }),
			expect.any(Object),
		);
	});

	it('blocks CI release command when non-bin files are dirty', async() => {
		getWorkingTreeStatusMock.mockResolvedValueOnce({
			branch: 'main',
			changes: [{ indexStatus: 'M', workingTreeStatus: ' ', path: 'dist/index.mjs', raw: 'M  dist/index.mjs' }],
			isClean: false,
		});

		await expect(handleRelease({ ...options, isCI: true }, false)).rejects.toThrow('Release requires a clean git working tree');
		expect(publishPackagesMock).not.toHaveBeenCalled();
	});
});
