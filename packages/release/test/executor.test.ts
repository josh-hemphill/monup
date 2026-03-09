import type { DetectResult } from 'package-manager-detector';
import type { CommandConfig } from '../src/detector.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executePublish } from '../src/executor.ts';

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
});
