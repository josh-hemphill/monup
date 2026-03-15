import type { DetectResult } from 'package-manager-detector';
import type { CommandConfig } from '../src/detector.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executePublish, executePublishRecursivePnpm } from '../src/executor.ts';

const { spawnCommandMock } = vi.hoisted(() => ({
	spawnCommandMock: vi.fn(async() => undefined),
}));

vi.mock('../src/spawn.ts', async() => {
	const actual = await vi.importActual<typeof import('../src/spawn.ts')>('../src/spawn.ts');
	return {
		...actual,
		spawnCommand: spawnCommandMock,
	};
});

const { getPublishBranchMock } = vi.hoisted(() => ({
	getPublishBranchMock: vi.fn(async(): Promise<string | undefined> => undefined),
}));

vi.mock('../src/detector.ts', async(importOriginal) => {
	const actual = await importOriginal<typeof import('../src/detector.ts')>();
	return {
		...actual,
		getPublishBranch: getPublishBranchMock,
	};
});

function createCommandConfig(name: DetectResult['name'], publishType: CommandConfig['publishType']): CommandConfig {
	const command: DetectResult = {
		name,
		agent: name,
		version: undefined,
	};
	return {
		command,
		publishType,
	};
}

describe('executePublish', () => {
	beforeEach(() => {
		spawnCommandMock.mockClear();
		getPublishBranchMock.mockReset();
		getPublishBranchMock.mockResolvedValue(undefined);
	});

	it('adds pnpm dirty tree bypass when allowed', async() => {
		await executePublish(
			'/workspace/pkg',
			createCommandConfig('pnpm', 'npm'),
			false,
			[],
			true,
		);

		expect(spawnCommandMock).toHaveBeenCalledWith(
			'pnpm',
			['publish', '--no-git-checks'],
			{ cwd: '/workspace/pkg', capture: 'inherit' },
		);
	});

	it('does not add pnpm dirty tree bypass for non-pnpm commands', async() => {
		await expect(executePublish(
			'/workspace/pkg',
			createCommandConfig('npm', 'npm'),
			false,
			[],
			true,
		)).rejects.toThrow('Allow dirty is not supported for npm npm');
		expect(spawnCommandMock).not.toHaveBeenCalled();
	});

	it('adds --publish-branch from workspace root when pnpm and workspaceRoot provided', async() => {
		getPublishBranchMock.mockResolvedValueOnce('latest');
		await executePublish(
			'/workspace/pkg',
			createCommandConfig('pnpm', 'npm'),
			false,
			[],
			false,
			'/workspace',
		);
		expect(getPublishBranchMock).toHaveBeenCalledWith('/workspace');
		expect(spawnCommandMock).toHaveBeenCalledWith(
			'pnpm',
			['publish', '--publish-branch', 'latest'],
			{ cwd: '/workspace/pkg', capture: 'inherit' },
		);
	});

	it('does not add --publish-branch when getPublishBranch returns undefined', async() => {
		getPublishBranchMock.mockResolvedValueOnce(undefined);
		await executePublish(
			'/workspace/pkg',
			createCommandConfig('pnpm', 'npm'),
			false,
			[],
			false,
			'/workspace',
		);
		expect(spawnCommandMock).toHaveBeenCalledWith(
			'pnpm',
			['publish'],
			{ cwd: '/workspace/pkg', capture: 'inherit' },
		);
	});
});

describe('executePublishRecursivePnpm', () => {
	beforeEach(() => {
		spawnCommandMock.mockClear();
		getPublishBranchMock.mockReset();
		getPublishBranchMock.mockResolvedValue(undefined);
	});

	it('throws when publish type is not npm', async() => {
		await expect(executePublishRecursivePnpm(
			'/workspace',
			createCommandConfig('pnpm', 'jsr'),
			false,
			[],
			false,
		)).rejects.toThrow('executePublishRecursivePnpm requires pnpm and npm publish type');
		expect(spawnCommandMock).not.toHaveBeenCalled();
	});

	it('throws when command is not pnpm', async() => {
		await expect(executePublishRecursivePnpm(
			'/workspace',
			createCommandConfig('npm', 'npm'),
			false,
			[],
			false,
		)).rejects.toThrow('executePublishRecursivePnpm requires pnpm and npm publish type');
		expect(spawnCommandMock).not.toHaveBeenCalled();
	});

	it('runs pnpm -r publish from workspace root with flags', async() => {
		getPublishBranchMock.mockResolvedValueOnce('latest');
		await executePublishRecursivePnpm(
			'/workspace',
			createCommandConfig('pnpm', 'npm'),
			true,
			['--no-git-checks'],
			true,
		);
		expect(getPublishBranchMock).toHaveBeenCalledWith('/workspace');
		expect(spawnCommandMock).toHaveBeenCalledWith(
			'pnpm',
			['-r', 'publish', '--no-git-checks', '--publish-branch', 'latest', '--no-git-checks', '--dry-run'],
			{ cwd: '/workspace', capture: 'inherit' },
		);
	});
});
