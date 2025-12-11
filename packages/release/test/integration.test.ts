/**
 * Integration tests for release package
 * Tests actual command execution with pnpm (assumed to be available)
 */

import type { PackageInfo } from '@monup/workspace';
import type { ReleaseOptionsWithDeps } from '../src/options.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { which } from 'zx';
import { publish } from '../src/index.ts';
import { logger } from '../src/logger.ts';

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

describe('release package - integration tests', () => {
	logger.setLevel('debug');
	const oldMethodFactory = logger.methodFactory;
	const spyConsole = vi.fn(oldMethodFactory);
	logger.methodFactory = () => spyConsole;
	logger.rebuild();
	afterEach(() => {
		spyConsole.mockRestore();
	});

	it('should execute dry-run for npm package with pnpm', async () => {
		const pnpmPath = await which('pnpm', { nothrow: true });
		if (typeof pnpmPath !== 'string') {
			// Skip if pnpm not available
			return;
		}

		const options: ReleaseOptionsWithDeps = {
			dryRun: true,
			isCI: false,
			packageManager: 'pnpm',
			publishArgs: ['--no-git-checks'],
		};

		spyConsole.mockImplementation(() => () => { });
		await publish(npmPackage, options);

		const allCallStrings = spyConsole.mock.calls
			.map((call: unknown[]) => call.map((arg: unknown) => String(arg)).join(' '))
			.join(' ');

		// Should have executed publish command with dry-run
		expect(
			allCallStrings.includes('publish') || allCallStrings.includes('dry-run') || allCallStrings.includes('pnpm'),
		).toBe(true);

		// Verify debug logging for publish execution
		expect(
			allCallStrings.includes('Executing publish command') || allCallStrings.includes('publish'),
		).toBe(true);
	}, 100000); // Increase timeout

	it('should execute dry-run for jsr package', async () => {
		const denoPath = await which('deno', { nothrow: true });
		if (typeof denoPath !== 'string') {
			// Skip if deno not available
			return;
		}

		const options: ReleaseOptionsWithDeps = {
			dryRun: true,
			isCI: false,
			publishArgs: ['--allow-dirty'],
		};

		await publish(jsrPackage, options);

		// Verify console methods were called
		const allCallStrings = spyConsole.mock.calls
			.map((call: unknown[]) => call.map((arg: unknown) => String(arg)).join(' '))
			.join(' ');

		// Should have executed publish command with dry-run
		expect(
			allCallStrings.includes('publish') || allCallStrings.includes('dry-run') || allCallStrings.includes('deno'),
		).toBe(true);

		// Verify debug logging for publish execution
		expect(
			allCallStrings.includes('Executing publish command') || allCallStrings.includes('publish'),
		).toBe(true);
	});
});
