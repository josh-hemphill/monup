import type { PackageInfo } from '@monup/workspace';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runVersionBump } from '../src/index.ts';

describe('runVersionBump', () => {
	let testDir: string;
	let pkg1File: string;
	let pkg2File: string;
	let packages: PackageInfo[];

	beforeEach(async () => {
		testDir = join(tmpdir(), `monup-version-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const pkg1Dir = join(testDir, 'packages', 'pkg1');
		const pkg2Dir = join(testDir, 'packages', 'pkg2');
		await mkdir(pkg1Dir, { recursive: true });
		await mkdir(pkg2Dir, { recursive: true });

		pkg1File = join(pkg1Dir, 'package.json');
		pkg2File = join(pkg2Dir, 'package.json');
		await writeFile(pkg1File, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2), 'utf-8');
		await writeFile(pkg2File, JSON.stringify({ name: 'pkg2', version: '1.0.0' }, null, 2), 'utf-8');

		packages = [
			{ name: 'pkg1', path: pkg1Dir, root: testDir, packageFile: pkg1File },
			{ name: 'pkg2', path: pkg2Dir, root: testDir, packageFile: pkg2File },
		];
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it('bumps only the package with matching commits', async () => {
		await runVersionBump(
			{
				version: {
					strategy: 'per-package',
					files: [],
					install: false,
					ignoreScripts: false,
				},
				git: {
					commit: false,
					push: false,
					tag: false,
					sign: false,
					noVerify: false,
					tagStrategy: 'global',
					tagTemplate: 'v%s',
				},
			},
			packages,
			{
				workspaceRoot: testDir,
				commits: [
					{
						hash: 'abc123',
						message: 'feat: pkg1 feature',
						author: 'test',
						date: '2024-01-01',
						type: 'feat',
						subject: 'pkg1 feature',
						packages: ['pkg1'],
					},
				],
			},
		);

		const pkg1 = JSON.parse(await readFile(pkg1File, 'utf-8')) as { version: string };
		const pkg2 = JSON.parse(await readFile(pkg2File, 'utf-8')) as { version: string };

		expect(pkg1.version).toBe('1.1.0');
		expect(pkg2.version).toBe('1.0.0');
	});

	it('supports forced bumpType', async () => {
		await runVersionBump(
			{
				version: {
					strategy: 'per-package',
					files: [],
					install: false,
					ignoreScripts: false,
				},
				git: {
					commit: false,
					push: false,
					tag: false,
					sign: false,
					noVerify: false,
					tagStrategy: 'global',
					tagTemplate: 'v%s',
				},
			},
			[packages[0]!],
			{
				workspaceRoot: testDir,
				commits: [],
				bumpType: 'patch',
			},
		);

		const pkg1 = JSON.parse(await readFile(pkg1File, 'utf-8')) as { version: string };
		expect(pkg1.version).toBe('1.0.1');
	});
});
