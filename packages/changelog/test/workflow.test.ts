import type { PackageInfo } from '@monup/workspace';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runChangelog } from '../src/index.ts';
import { defaultChangelogOptions } from '../src/options.ts';

describe('runChangelog', () => {
	let testDir: string;
	let pkg1: PackageInfo;
	let pkg2: PackageInfo;
	let packages: PackageInfo[];

	beforeEach(async () => {
		testDir = join(tmpdir(), `monup-changelog-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const pkg1Dir = join(testDir, 'packages', 'pkg1');
		const pkg2Dir = join(testDir, 'packages', 'pkg2');
		await mkdir(pkg1Dir, { recursive: true });
		await mkdir(pkg2Dir, { recursive: true });

		await writeFile(join(pkg1Dir, 'package.json'), JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2), 'utf-8');
		await writeFile(join(pkg2Dir, 'package.json'), JSON.stringify({ name: 'pkg2', version: '1.0.0' }, null, 2), 'utf-8');

		pkg1 = { name: 'pkg1', path: pkg1Dir, root: testDir, packageFile: join(pkg1Dir, 'package.json') };
		pkg2 = { name: 'pkg2', path: pkg2Dir, root: testDir, packageFile: join(pkg2Dir, 'package.json') };
		packages = [pkg1, pkg2];
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it('creates per-package changelog only for packages with commits', async () => {
		await runChangelog(
			{
				changelog: {
					...defaultChangelogOptions,
					strategy: 'per-package',
					location: 'CHANGELOG.md',
				},
				git: {
					tagStrategy: 'global',
					tagTemplate: 'v%s',
				},
				root: testDir,
			},
			packages,
			[
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
		);

		const pkg1Changelog = await readFile(join(pkg1.path, 'CHANGELOG.md'), 'utf-8');
		expect(pkg1Changelog).toContain('pkg1');
		await expect(stat(join(pkg2.path, 'CHANGELOG.md'))).rejects.toThrow();
	});

	it('creates root changelog for root strategy', async () => {
		await runChangelog(
			{
				changelog: {
					...defaultChangelogOptions,
					strategy: 'root',
					location: join(testDir, 'ROOT_CHANGELOG.md'),
				},
				git: {
					tagStrategy: 'global',
					tagTemplate: 'v%s',
				},
				root: testDir,
			},
			[pkg1],
			[
				{
					hash: 'abc123',
					message: 'feat: root change',
					author: 'test',
					date: '2024-01-01',
					type: 'feat',
					subject: 'root change',
				},
			],
		);

		const rootChangelog = await readFile(join(testDir, 'ROOT_CHANGELOG.md'), 'utf-8');
		expect(rootChangelog).toContain('## [');
		expect(rootChangelog).toContain('root');
	});
});
