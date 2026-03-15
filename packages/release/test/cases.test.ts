/**
 * Test cases for release package
 * Tests dry-run logic and publish decision making.
 * Actual publishing requires network access and credentials.
 */

import type { PackageInfo } from '@monup/workspace';
import type { CommandConfig } from '../src/detector.ts';
import type { ReleaseOptionsWithDeps } from '../src/options.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publish } from '../src/index.ts';
import { defaultReleaseOptions } from '../src/options.ts';

const { detectPackageManagerMock, executePublishMock } = vi.hoisted(() => ({
	detectPackageManagerMock: vi.fn(async(pkg: PackageInfo): Promise<CommandConfig> => ({
		publishType: pkg.packageFile?.endsWith('jsr.json') ? 'jsr' : 'npm',
		command: {
			name: pkg.packageFile?.endsWith('jsr.json') ? 'deno' : 'pnpm',
			agent: pkg.packageFile?.endsWith('jsr.json') ? 'deno' : 'pnpm',
			version: undefined,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const npmPackage: PackageInfo = {
	name: 'test-npm-package',
	path: join(fixturesDir, 'npm-package'),
	root: join(fixturesDir, 'npm-package'),
	packageFile: join(fixturesDir, 'npm-package', 'package.json'),
};

const jsrPackage: PackageInfo = {
	name: 'test-jsr-package',
	path: join(fixturesDir, 'jsr-package'),
	root: join(fixturesDir, 'jsr-package'),
	packageFile: join(fixturesDir, 'jsr-package', 'jsr.json'),
};

describe('release package - shell command test cases', () => {
	beforeEach(() => {
		detectPackageManagerMock.mockClear();
		executePublishMock.mockClear();
	});

	it('should identify npm package correctly', async() => {
		const options: ReleaseOptionsWithDeps = {
			dryRun: true,
			isCI: false,
		};
		await publish(npmPackage, options);
		expect(detectPackageManagerMock).toHaveBeenCalledWith(
			npmPackage,
			expect.objectContaining({
				...defaultReleaseOptions,
				dryRun: true,
				isCI: false,
			}),
		);
		expect(executePublishMock).toHaveBeenCalledWith(
			npmPackage.path,
			expect.objectContaining({
				publishType: 'npm',
				command: expect.objectContaining({ name: 'pnpm' }) as CommandConfig['command'],
			}),
			true,
			[],
			false,
			npmPackage.root,
		);
	});

	it('should identify jsr package correctly', async() => {
		const options: ReleaseOptionsWithDeps = {
			dryRun: true,
			isCI: false,
		};
		await publish(jsrPackage, options);
		expect(detectPackageManagerMock).toHaveBeenCalledWith(
			jsrPackage,
			expect.objectContaining({
				...defaultReleaseOptions,
				dryRun: true,
				isCI: false,
			}),
		);
		expect(executePublishMock).toHaveBeenCalledWith(
			jsrPackage.path,
			expect.objectContaining({
				publishType: 'jsr',
				command: expect.objectContaining({ name: 'deno' }) as CommandConfig['command'],
			}),
			true,
			[],
			false,
			jsrPackage.root,
		);
	});

	it('should use dry-run when dryRun is true', async() => {
		const options: ReleaseOptionsWithDeps = {
			dryRun: true,
			isCI: false,
		};
		await publish(npmPackage, options);
		expect(executePublishMock).toHaveBeenCalledWith(
			npmPackage.path,
			expect.any(Object),
			true,
			[],
			false,
			npmPackage.root,
		);
	});

	it('should use dry-run when dryRun is auto and not in CI', async() => {
		const options: ReleaseOptionsWithDeps = {
			dryRun: 'auto',
			isCI: false, // Should trigger dry-run
		};
		await publish(npmPackage, options);
		expect(executePublishMock).toHaveBeenCalledWith(
			npmPackage.path,
			expect.any(Object),
			true,
			[],
			false,
			npmPackage.root,
		);
	});

	it('should not use dry-run when dryRun is auto and in CI', async() => {
		const options: ReleaseOptionsWithDeps = {
			dryRun: 'auto',
			isCI: true, // Should NOT trigger dry-run
		};
		await publish(npmPackage, options);
		expect(executePublishMock).toHaveBeenCalledWith(
			npmPackage.path,
			expect.any(Object),
			false,
			[],
			false,
			npmPackage.root,
		);
	});
});
