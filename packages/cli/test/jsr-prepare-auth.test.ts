import type { ResolvedMonupOptions } from '@monup/options';
import type { PromptSession } from '../src/commands/jsr-prepare.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/logger.ts';

const {
	createJsrAuthorizationMock,
	pollJsrAuthorizationMock,
	resolveJsrSetupTokenMock,
	setupJsrPackagesMock,
	openExternalUrlMock,
	getPackagesWithCacheMock,
} = vi.hoisted(() => ({
	createJsrAuthorizationMock: vi.fn(async() => ({
		verificationUrl: 'https://jsr.io/authorize/test',
		code: 'ABC123',
		exchangeToken: 'exchange-token',
		pollInterval: 1,
		expiresAt: '2099-01-01T00:00:00.000Z',
		verifier: 'verifier',
		challenge: 'challenge',
	})),
	pollJsrAuthorizationMock: vi.fn(async() => ({
		token: 'jsrw_interactive_token',
		user: { id: 'user-id', name: 'Test User' },
	})),
	resolveJsrSetupTokenMock: vi.fn(() => 'jsrw_env_token'),
	setupJsrPackagesMock: vi.fn(async() => []),
	openExternalUrlMock: vi.fn(async() => true),
	getPackagesWithCacheMock: vi.fn(async() => ([
		{
			name: 'pkg1',
			path: 'E:/Share/dev/monup/packages/cli/test/fixtures/with-package-description',
			root: '/workspace',
			packageFile: 'E:/Share/dev/monup/packages/cli/test/fixtures/with-package-description/jsr.json',
		},
	])),
}));

vi.mock('@monup/release', async() => {
	const actual = await vi.importActual<typeof import('@monup/release')>('@monup/release');
	return {
		...actual,
		createJsrAuthorization: createJsrAuthorizationMock,
		pollJsrAuthorization: pollJsrAuthorizationMock,
		resolveJsrSetupToken: resolveJsrSetupTokenMock,
		setupJsrPackages: setupJsrPackagesMock,
	};
});

vi.mock('@monup/utils', async() => {
	const actual = await vi.importActual<typeof import('@monup/utils')>('@monup/utils');
	return {
		...actual,
		openExternalUrl: openExternalUrlMock,
	};
});

vi.mock('../src/package-utils.ts', () => ({
	getPackagesWithCache: getPackagesWithCacheMock,
}));

const { handleJsrPrepare, resolveJsrPrepareToken } = await import('../src/commands/jsr-prepare.ts');

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
		repo: 'monup/monup',
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

function createPromptSession(): PromptSession {
	return {
		promptText: vi.fn(async(_message: string, defaultValue?: string) => defaultValue ?? ''),
		confirm: vi.fn(async(_message: string, initialValue?: boolean) => initialValue ?? false),
		select: vi.fn(async(_message, _options, initialValue) => initialValue),
		close: vi.fn(),
	};
}

describe('resolveJsrPrepareToken', () => {
	beforeEach(() => {
		createJsrAuthorizationMock.mockClear();
		pollJsrAuthorizationMock.mockClear();
		resolveJsrSetupTokenMock.mockClear();
		setupJsrPackagesMock.mockClear();
		openExternalUrlMock.mockClear();
		getPackagesWithCacheMock.mockClear();
	});

	it('uses interactive authorization by default when a prompt session is available', async() => {
		const token = await resolveJsrPrepareToken(createPromptSession(), false);

		expect(token).toBe('jsrw_interactive_token');
		expect(createJsrAuthorizationMock).toHaveBeenCalledTimes(1);
		expect(openExternalUrlMock).toHaveBeenCalledWith('https://jsr.io/authorize/test');
		expect(pollJsrAuthorizationMock).toHaveBeenCalledTimes(1);
		expect(resolveJsrSetupTokenMock).not.toHaveBeenCalled();
	});

	it('logs the fallback URL and code when browser opening fails', async() => {
		const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
		const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
		openExternalUrlMock.mockResolvedValueOnce(false);

		await resolveJsrPrepareToken(createPromptSession(), false);

		expect(warnSpy).toHaveBeenCalledWith(
			'Unable to open the browser automatically. Continue with the URL and code shown below.',
		);
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Enter this code in the JSR page:'));
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('\nABC123\n'));
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Verification URL: https://jsr.io/authorize/test'));
	});

	it('falls back to JSR_TOKEN in non-interactive mode', async() => {
		const token = await resolveJsrPrepareToken(undefined, false);

		expect(token).toBe('jsrw_env_token');
		expect(resolveJsrSetupTokenMock).toHaveBeenCalledTimes(1);
		expect(createJsrAuthorizationMock).not.toHaveBeenCalled();
	});

	it('propagates interactive authorization failures', async() => {
		const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
		pollJsrAuthorizationMock.mockRejectedValueOnce(new Error('Authorization timed out'));

		await expect(resolveJsrPrepareToken(createPromptSession(), false)).rejects.toThrow('Authorization timed out');
		expect(errorSpy).toHaveBeenCalledWith(
			'JSR authorization failed. Re-run with --log-level debug for more details.',
			{ message: 'Authorization timed out' },
		);
	});
});

describe('handleJsrPrepare auth integration', () => {
	it('passes the interactive auth token into setupJsrPackages', async() => {
		await handleJsrPrepare(options, {
			githubOwner: 'monup',
			githubName: 'monup',
		}, createPromptSession());

		expect(setupJsrPackagesMock).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				token: 'jsrw_interactive_token',
				githubRepository: { owner: 'monup', name: 'monup' },
			}),
		);
	});
});
