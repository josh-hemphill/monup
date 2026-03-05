/**
 * Tests for package manager detection
 */

import type { PackageInfo } from '@monup/workspace';
import type { AgentName } from 'package-manager-detector';
import type { MockedFunction } from 'vitest';
import type { ReleaseOptions } from '../src/options.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pmd from 'package-manager-detector';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as zx from 'zx';
import { detectPackageManager } from '../src/detector.ts';
import { resolveReleaseOptions } from '../src/options.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

// Mock zx's which function
vi.mock('zx', async() => {
	const actual = await vi.importActual<typeof zx>('zx');
	return {
		...actual,
		which: vi.fn<typeof zx.which>(),
	};
});

// Mock spawn to avoid spawning real commands (which may not exist on Windows)
// Simulate "command not found" by returning undefined (getCommandRunVersion catches throw)
vi.mock('../src/spawn.ts', () => ({
	spawnCommand: vi.fn(async(_cmd: string, _args: string[], opts?: { capture?: string }) => {
		if (opts?.capture === 'text') {
			// Throw to simulate missing command; getCommandRunVersion catches and returns undefined
			throw new Error('ENOENT');
		}
	}),
}));

// Mock package-manager-detector
vi.mock('package-manager-detector', async() => {
	const actual = await vi.importActual<typeof pmd>('package-manager-detector');
	return {
		...actual,
		detect: vi.fn<typeof pmd.detect>(async(options) => actual.detect({
			...options,
		})),
	};
});

describe('detector', () => {
	let mockWhich: MockedFunction<typeof zx.which>;
	let mockDetect: MockedFunction<typeof pmd.detect>;
	beforeEach(() => {
		mockWhich = vi.mocked(zx.which, { partial: true });
		// Default: all commands available
		mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
			if (['npm', 'pnpm', 'yarn', 'deno'].includes(cmd)) {
				return `/usr/local/bin/${cmd}`;
			}
			return '';
		});
		mockDetect = vi.mocked(pmd.detect);
		// Default: package-manager-detector returns null (no lockfiles/install-metadata in fixtures)
		// Tests can override this to simulate lockfile/install-metadata detection
		mockDetect.mockResolvedValue(null);
	});

	describe('priority 1: Explicit Override', () => {
		it('should use explicit override when provided', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			const options: ReleaseOptions = {
				packageManager: 'pnpm',
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('pnpm');
			expect(result.command.agent).toBe('pnpm');
			expect(result.command.version).toBeUndefined();
			expect(mockWhich).toHaveBeenCalledWith('pnpm', { nothrow: true });
		});

		it('should use deno native for JSR packages when deno is override', async() => {
			const pkg: PackageInfo = {
				name: 'test-jsr-package',
				path: join(fixturesDir, 'jsr-package'),
				root: join(fixturesDir, 'jsr-package'),
				packageFile: join(fixturesDir, 'jsr-package', 'jsr.json'),
			};
			const options: ReleaseOptions = {
				packageManager: 'deno',
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('deno');
			expect(result.command.agent).toBe('deno');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('jsr');
		});

		it('should throw error in strict mode when override is not available', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockResolvedValue('');
			const options: ReleaseOptions = {
				packageManager: 'nonexistent' as AgentName,
				strict: true,
			};

			await expect(detectPackageManager(pkg, resolveReleaseOptions(options))).rejects.toThrow(
				'Specified package manager not available: nonexistent',
			);
		});

		it('should continue detection in non-strict mode when override is not available', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
				if (cmd === 'nonexistent') {
					return '';
				}
				if (cmd === 'npm') {
					return '/usr/local/bin/npm';
				}
				return '';
			});
			const options: ReleaseOptions = {
				packageManager: 'nonexistent' as AgentName,
				strict: false,
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should fall through to other priorities
			expect(result.command.name).toBe('npm');
			expect(result.command.agent).toBe('npm');
			expect(result.command.version).toBeUndefined();
		});
	});

	describe('priority 2: Workspace Context', () => {
		it('should detect pnpm workspace', async() => {
			const workspaceRoot = join(fixturesDir, 'pnpm-workspace');
			const pkg: PackageInfo = {
				name: 'pkg1',
				path: join(workspaceRoot, 'packages', 'pkg1'),
				root: workspaceRoot,
				packageFile: join(workspaceRoot, 'packages', 'pkg1', 'package.json'),
			};

			const options: ReleaseOptions = {};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('pnpm');
			expect(result.command.agent).toBe('pnpm');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});

		it('should detect npm workspace with packageManager field', async() => {
			const workspaceRoot = join(fixturesDir, 'npm-workspace-yarn');
			const pkg: PackageInfo = {
				name: 'pkg1',
				path: join(workspaceRoot, 'packages', 'pkg1'),
				root: workspaceRoot,
				packageFile: join(workspaceRoot, 'packages', 'pkg1', 'package.json'),
			};

			// Restrict to workspace context only so test passes in CI (where pnpm is available)
			const options: ReleaseOptions = {
				detectionOrder: ['checkExplicitOverride', 'checkWorkspaceContext'],
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});

		it('should detect deno workspace', async() => {
			const workspaceRoot = join(fixturesDir, 'deno-workspace');
			const pkg: PackageInfo = {
				name: 'pkg1',
				path: join(workspaceRoot, 'packages', 'pkg1'),
				root: workspaceRoot,
				packageFile: join(workspaceRoot, 'packages', 'pkg1', 'jsr.json'),
			};

			// Restrict to workspace context only so test passes in CI (where pnpm is available)
			const options: ReleaseOptions = {
				detectionOrder: ['checkExplicitOverride', 'checkWorkspaceContext'],
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('deno');
			expect(result.command.agent).toBe('deno');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('jsr');
		});

		it('should resolve conflicts using commandPriority', async() => {
			const workspaceRoot = join(fixturesDir, 'conflict-workspace');
			const pkg: PackageInfo = {
				name: 'pkg1',
				path: join(workspaceRoot, 'packages', 'pkg1'),
				root: workspaceRoot,
				packageFile: join(workspaceRoot, 'packages', 'pkg1', 'package.json'),
			};

			// With default priority (pnpm > yarn), should prefer pnpm
			const options1: ReleaseOptions = {};
			const result1 = await detectPackageManager(pkg, resolveReleaseOptions(options1));
			expect(result1.command.name).toBe('pnpm');
			expect(result1.command.agent).toBe('pnpm');
			expect(result1.command.version).toBeUndefined();
			expect(result1.publishType).toBe('npm');

			// With custom priority (yarn > pnpm), should prefer yarn
			const options2: ReleaseOptions = {
				commandPriority: ['yarn', 'pnpm', 'npm', 'deno'],
			};
			const result2 = await detectPackageManager(pkg, resolveReleaseOptions(options2));
			expect(result2.command.name).toBe('yarn');
			expect(result2.command.agent).toBe('yarn');
			expect(result2.command.version).toBeUndefined();
			expect(result2.publishType).toBe('npm');
		});

		it('should not detect workspace if package is not in workspace pattern', async() => {
			const workspaceRoot = join(fixturesDir, 'outside-workspace');
			const packagePath = join(workspaceRoot, 'other', 'pkg1');
			const pkg: PackageInfo = {
				name: 'pkg1',
				path: packagePath,
				root: workspaceRoot,
				packageFile: join(packagePath, 'package.json'),
			};

			const options: ReleaseOptions = {
				commandPriority: ['yarn', 'pnpm', 'npm', 'deno'],
			};
			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should fall through to package-manager-detector (which returns null), then to command availability
			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});
	});

	describe('priority 2.5: JSR Deno Preference', () => {
		it('should prefer deno when deno.json exists and deno is available', async() => {
			const pkg: PackageInfo = {
				name: 'test-jsr-with-deno',
				path: join(fixturesDir, 'jsr-with-deno-json'),
				root: join(fixturesDir, 'jsr-with-deno-json'),
				packageFile: join(fixturesDir, 'jsr-with-deno-json', 'jsr.json'),
			};

			const options: ReleaseOptions = {};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('deno');
			expect(result.command.agent).toBe('deno');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('jsr');
		});

		it('should not prefer deno if deno.json exists but deno is not available', async() => {
			const pkg: PackageInfo = {
				name: 'test-jsr-with-deno',
				path: join(fixturesDir, 'jsr-with-deno-json'),
				root: join(fixturesDir, 'jsr-with-deno-json'),
				packageFile: join(fixturesDir, 'jsr-with-deno-json', 'jsr.json'),
			};

			mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
				if (cmd === 'deno') {
					return '';
				}
				if (cmd === 'npm') {
					return '/usr/local/bin/npm';
				}
				return '';
			});

			const options: ReleaseOptions = {};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should fall through to package-manager-detector (which returns null), then to command availability
			expect(result.command.name).toBe('npm');
			expect(result.command.agent).toBe('npm');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('jsr');
		});

		it('should not apply to npm packages', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};

			const options: ReleaseOptions = {};
			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should not use deno preference for npm packages
			expect(result.command.name).toBe('pnpm');
			expect(result.command.agent).toBe('pnpm');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});
	});

	describe('priority 3: package-manager-detector', () => {
		it('should use package-manager-detector result from lockfile/install-metadata', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};

			const options: ReleaseOptions = {};

			// Simulate package-manager-detector finding yarn from lockfile/install-metadata
			mockDetect.mockResolvedValue({ name: 'yarn', agent: 'yarn' });
			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));
			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
			expect(mockDetect).toHaveBeenCalledWith({
				cwd: pkg.path,
				stopDir: pkg.path,
				strategies: ['install-metadata', 'lockfile'],
			});
		});
	});

	describe('priority 4: Command Availability', () => {
		it('should use first available command from priority list', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
				// Only yarn is available
				if (cmd === 'yarn') {
					return '/usr/local/bin/yarn';
				}
				return '';
			});

			const options: ReleaseOptions = {};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});

		it('should respect excludedCommands', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
				if (['pnpm', 'yarn'].includes(cmd)) {
					return `/usr/local/bin/${cmd}`;
				}
				return '';
			});

			const options: ReleaseOptions = {
				excludedCommands: ['pnpm'],
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should skip pnpm and use yarn
			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});

		it('should respect custom commandPriority', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockImplementation(async(cmd: string, _options: Parameters<typeof zx.which>[1]) => {
				if (['npm', 'pnpm'].includes(cmd)) {
					return `/usr/local/bin/${cmd}`;
				}
				return '';
			});

			const options: ReleaseOptions = {
				commandPriority: ['npm', 'pnpm', 'yarn', 'deno'],
			};
			mockDetect.mockResolvedValue(null);

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should use npm first due to custom priority
			expect(result.command.name).toBe('npm');
			expect(result.command.agent).toBe('npm');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});
	});

	describe('custom Detection Order', () => {
		it('should respect custom detectionOrder', async() => {
			const pkg: PackageInfo = {
				name: 'workspace-root',
				path: join(fixturesDir, 'npm-workspace-yarn'),
				root: join(fixturesDir, 'npm-workspace-yarn'),
				packageFile: join(fixturesDir, 'npm-workspace-yarn', 'package.json'),
			};

			const options: ReleaseOptions = {
				detectionOrder: [
					'checkPackageManagerDetector',
					'checkCommandAvailability',
					'checkWorkspaceContext',
				],
			};

			// Simulate package-manager-detector finding yarn from lockfile/install-metadata
			mockDetect.mockResolvedValue({ name: 'yarn', agent: 'yarn' });

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should use package-manager-detector first
			expect(result.command.name).toBe('yarn');
			expect(result.command.agent).toBe('yarn');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
			expect(mockDetect).toHaveBeenCalledWith({
				cwd: pkg.path,
				stopDir: pkg.path,
				strategies: ['install-metadata', 'lockfile'],
			});
		});

		it('should skip unknown detection checks', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};

			const options: ReleaseOptions = {
				detectionOrder: [
					'checkExplicitOverride',
					'unknownCheck' as any,
					'checkCommandAvailability',
				],
			};

			const result = await detectPackageManager(pkg, resolveReleaseOptions(options));

			// Should skip unknown check and continue
			expect(result.command.name).toBe('pnpm');
			expect(result.command.agent).toBe('pnpm');
			expect(result.command.version).toBeUndefined();
			expect(result.publishType).toBe('npm');
		});
	});

	describe('error Handling', () => {
		it('should throw error when no package manager is available (strict mode)', async() => {
			const pkg: PackageInfo = {
				name: 'test-npm-package',
				path: join(fixturesDir, 'npm-package'),
				root: join(fixturesDir, 'npm-package'),
				packageFile: join(fixturesDir, 'npm-package', 'package.json'),
			};
			mockWhich.mockResolvedValue('');

			const options: ReleaseOptions = {
				strict: true,
			};

			await expect(detectPackageManager(pkg, resolveReleaseOptions(options))).rejects.toThrow(
				'No package manager available',
			);
		});

		it('should throw error for unknown package type', async() => {
			const pkg: PackageInfo = {
				name: 'test',
				path: fixturesDir,
				root: fixturesDir,
				packageFile: join(fixturesDir, 'unknown.json'),
			};

			const options: ReleaseOptions = {};

			await expect(detectPackageManager(pkg, resolveReleaseOptions(options))).rejects.toThrow(
				'Unknown package type',
			);
		});
	});
});
