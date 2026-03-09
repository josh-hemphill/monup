import type { ResolvedMonupOptions } from '@monup/options';
import type { PackageInfo } from '@monup/workspace';
import type { PromptSession } from '../src/commands/jsr-prepare.ts';
import { describe, expect, it, vi } from 'vitest';
import { inferPackageDescription, resolveJsrPrepareInput } from '../src/commands/jsr-prepare.ts';

const packages: PackageInfo[] = [
	{
		name: 'with-package-description',
		path: 'E:/Share/dev/monup/packages/cli/test/fixtures/with-package-description',
		root: '/workspace',
		packageFile: 'E:/Share/dev/monup/packages/cli/test/fixtures/with-package-description/jsr.json',
	},
	{
		name: 'readme-only',
		path: 'E:/Share/dev/monup/packages/cli/test/fixtures/readme-only',
		root: '/workspace',
		packageFile: 'E:/Share/dev/monup/packages/cli/test/fixtures/readme-only/jsr.json',
	},
];

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

function createPromptSession(config: {
	textAnswers?: string[];
	confirmAnswers?: boolean[];
	selectAnswers?: string[];
}): PromptSession {
	const textAnswers = [...(config.textAnswers ?? [])];
	const confirmAnswers = [...(config.confirmAnswers ?? [])];
	const selectAnswers = [...(config.selectAnswers ?? [])];

	return {
		promptText: vi.fn(async(_message: string, defaultValue?: string) => textAnswers.shift() ?? defaultValue ?? ''),
		confirm: vi.fn(async() => confirmAnswers.shift() ?? false),
		select: vi.fn(async<T extends string>(
			_message: string,
			_options: Array<{ value: T; label: string; hint?: string }>,
			initialValue: T,
		): Promise<T> => {
			const selectedValue = selectAnswers.shift();
			return (typeof selectedValue === 'string' ? selectedValue as T : undefined) ?? initialValue;
		}),
		close: vi.fn(),
	};
}

describe('inferPackageDescription', () => {
	it('prefers package.json descriptions', async() => {
		await expect(inferPackageDescription(packages[0])).resolves.toBe('Package description from package.json.');
	});

	it('falls back to the first README paragraph', async() => {
		await expect(inferPackageDescription(packages[1])).resolves.toBe(
			'Readme-only package description that should become the inferred JSR summary.',
		);
	});
});

describe('resolveJsrPrepareInput', () => {
	it('uses config defaults and inferred descriptions without per-package editing', async() => {
		const prompts = createPromptSession({
			selectAnswers: ['skip'],
			confirmAnswers: [false, true, false],
		});

		const result = await resolveJsrPrepareInput(options, packages, {}, prompts);

		expect(result.githubRepository).toEqual({ owner: 'monup', name: 'monup' });
		expect(result.packageOverrides).toEqual({
			'@scope/with-package-description': {
				description: 'Package description from package.json.',
			},
			'@scope/readme-only': {
				description: 'Readme-only package description that should become the inferred JSR summary.',
			},
		});
	});

	it('allows package-specific edits while keeping shared defaults on enter', async() => {
		const prompts = createPromptSession({
			textAnswers: ['Custom per-package description'],
			selectAnswers: ['skip', 'shared'],
			confirmAnswers: [false, true, true, true, false, false],
		});

		const result = await resolveJsrPrepareInput(options, packages, {}, prompts);

		expect(result.githubRepository).toEqual({ owner: 'monup', name: 'monup' });
		expect(result.packageOverrides).toEqual({
			'@scope/with-package-description': {
				description: 'Custom per-package description',
			},
			'@scope/readme-only': {
				description: 'Readme-only package description that should become the inferred JSR summary.',
			},
		});
	});
});
