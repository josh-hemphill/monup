import type { PackageInfo } from '@monup/workspace';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCommits, getFirstCommit } from '@monup/git';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { $, cd } from 'zx';
import { runChangelog } from '../src/index.ts';
import { defaultChangelogOptions } from '../src/options.ts';

describe('runChangelog', () => {
	let testDir: string;
	let pkg1: PackageInfo;
	let pkg2: PackageInfo;
	let packages: PackageInfo[];

	beforeEach(async() => {
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

	afterEach(async() => {
		await rm(testDir, { recursive: true, force: true });
	});

	it('creates per-package changelog only for packages with commits', async() => {
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

	it('creates root changelog for root strategy', async() => {
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
		expect(rootChangelog).toContain('## root@');
		expect(rootChangelog).toContain('root');
	});

	it('rebuilds changelog with stable version ordering and without duplicate version blocks', async() => {
		const existing = `# Changelog

<!-- monup:version:1.0.1:pkg1:start -->
## pkg1@1.0.1 - 2024-02-01
<!-- monup:version:1.0.1:pkg1:end -->

<!-- monup:version:1.0.0:pkg1:start -->
## pkg1@1.0.0 - 2024-01-01
### Features
- Old entry
<!-- monup:version:1.0.0:pkg1:end -->

<!-- monup:version:0.9.0:pkg1:start -->
## pkg1@0.9.0 - 2023-12-01
<!-- monup:version:0.9.0:pkg1:end -->
`;
		await writeFile(join(pkg1.path, 'CHANGELOG.md'), existing, 'utf-8');

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
					message: 'fix: pkg1 behavior',
					author: 'test',
					date: '2024-01-01',
					type: 'fix',
					subject: 'pkg1 behavior',
					packages: ['pkg1'],
				},
			],
		);

		const rebuilt = await readFile(join(pkg1.path, 'CHANGELOG.md'), 'utf-8');
		expect((rebuilt.match(/monup:version:1\.0\.0:pkg1:start/g) ?? []).length).toBe(1);
		const idx101 = rebuilt.indexOf('## pkg1@1.0.1');
		const idx100 = rebuilt.indexOf('## pkg1@1.0.0');
		const idx090 = rebuilt.indexOf('## pkg1@0.9.0');
		expect(idx101).toBeGreaterThanOrEqual(0);
		expect(idx100).toBeGreaterThanOrEqual(0);
		expect(idx090).toBeGreaterThanOrEqual(0);
		expect(idx101).toBeLessThan(idx100);
		expect(idx100).toBeLessThan(idx090);
		expect(rebuilt).toContain('Pkg1 behavior');
	});

	it('preserves empty version blocks when no renderable commit sections exist', async() => {
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
					message: 'chore: maintenance',
					author: 'test',
					date: '2024-01-01',
					type: 'chore',
					subject: 'maintenance',
					packages: ['pkg1'],
				},
			],
		);

		const rebuilt = await readFile(join(pkg1.path, 'CHANGELOG.md'), 'utf-8');
		expect(rebuilt).toContain('<!-- monup:version:1.0.0:pkg1:start -->');
		expect(rebuilt).toContain('## pkg1@1.0.0');
		expect(rebuilt).toContain('<!-- monup:version:1.0.0:pkg1:end -->');
		expect(rebuilt).not.toContain('### 🚀 Features');
	});

	it('bootstraps full per-package history from package tag intervals when changelog is missing', async() => {
		const repoRoot = join(testDir, 'repo');
		const pkg1Dir = join(repoRoot, 'packages', 'pkg1');
		const pkg2Dir = join(repoRoot, 'packages', 'pkg2');
		await mkdir(pkg1Dir, { recursive: true });
		await mkdir(pkg2Dir, { recursive: true });
		await writeFile(join(pkg1Dir, 'package.json'), JSON.stringify({ name: 'pkg1', version: '2.0.0' }, null, 2), 'utf-8');
		await writeFile(join(pkg2Dir, 'package.json'), JSON.stringify({ name: 'pkg2', version: '2.0.0' }, null, 2), 'utf-8');

		const originalCwd = process.cwd();
		try {
			cd(repoRoot);
			await $`git init`.quiet();
			await $`git config user.name "Test User"`.quiet();
			await $`git config user.email "test@example.com"`.quiet();
			await $`git config commit.gpgsign false`.quiet();

			await $`git add .`.quiet();
			await $`git commit -m "chore: initial packages"`.quiet();
			await $`git tag pkg1@1.0.0`.quiet();
			await $`git tag pkg2@1.0.0`.quiet();

			await writeFile(join(pkg1Dir, 'feature.ts'), 'export const one = 1;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: pkg1 fix"`.quiet();
			await $`git tag pkg1@1.1.0`.quiet();

			await writeFile(join(pkg2Dir, 'feature.ts'), 'export const two = 2;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: pkg2 fix"`.quiet();
			await $`git tag pkg2@1.1.0`.quiet();

			await writeFile(join(pkg1Dir, 'after-tag.ts'), 'export const three = 3;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: pkg1 after latest tag"`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		const repoPackages: PackageInfo[] = [
			{ name: 'pkg1', path: pkg1Dir, root: repoRoot, packageFile: join(pkg1Dir, 'package.json') },
			{ name: 'pkg2', path: pkg2Dir, root: repoRoot, packageFile: join(pkg2Dir, 'package.json') },
		];

		await runChangelog(
			{
				changelog: {
					...defaultChangelogOptions,
					strategy: 'per-package',
					location: 'CHANGELOG.md',
				},
				git: {
					tagStrategy: 'package',
					tagTemplate: 'v%s',
				},
				root: repoRoot,
			},
			repoPackages,
			[
				{
					hash: 'irrelevant',
					message: 'fix: this commit list should not drive bootstrap',
					author: 'test',
					date: '2024-01-01',
					type: 'fix',
					subject: 'this commit list should not drive bootstrap',
					packages: ['pkg1'],
				},
			],
		);

		const pkg1Changelog = await readFile(join(pkg1Dir, 'CHANGELOG.md'), 'utf-8');
		const pkg2Changelog = await readFile(join(pkg2Dir, 'CHANGELOG.md'), 'utf-8');

		expect(pkg1Changelog).toContain('## pkg1@1.1.0');
		expect(pkg1Changelog).toContain('## pkg1@1.0.0');
		expect(pkg1Changelog).not.toContain('## pkg1@2.0.0');
		expect(pkg1Changelog).toContain('Pkg1 fix');
		expect(pkg1Changelog).not.toContain('Pkg2 fix');

		expect(pkg2Changelog).toContain('## pkg2@1.1.0');
		expect(pkg2Changelog).toContain('## pkg2@1.0.0');
		expect(pkg2Changelog).toContain('Pkg2 fix');
		expect(pkg2Changelog).not.toContain('Pkg1 fix');
	});

	it('uses finalized tagged blocks only on subsequent runs', async() => {
		const repoRoot = join(testDir, 'repo-rerun');
		const pkg1Dir = join(repoRoot, 'packages', 'pkg1');
		await mkdir(pkg1Dir, { recursive: true });
		await writeFile(join(pkg1Dir, 'package.json'), JSON.stringify({ name: 'pkg1', version: '1.1.0' }, null, 2), 'utf-8');

		const originalCwd = process.cwd();
		try {
			cd(repoRoot);
			await $`git init`.quiet();
			await $`git config user.name "Test User"`.quiet();
			await $`git config user.email "test@example.com"`.quiet();
			await $`git config commit.gpgsign false`.quiet();

			await $`git add .`.quiet();
			await $`git commit -m "chore: initial package"`.quiet();
			await $`git tag pkg1@1.0.0`.quiet();

			await writeFile(join(pkg1Dir, 'feature.ts'), 'export const feature = true;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat: pkg1 previous feature"`.quiet();
			await $`git tag pkg1@1.1.0`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		const repoPackages: PackageInfo[] = [
			{ name: 'pkg1', path: pkg1Dir, root: repoRoot, packageFile: join(pkg1Dir, 'package.json') },
		];

		await runChangelog(
			{
				changelog: {
					...defaultChangelogOptions,
					strategy: 'per-package',
					location: 'CHANGELOG.md',
				},
				git: {
					tagStrategy: 'package',
					tagTemplate: 'v%s',
				},
				root: repoRoot,
			},
			repoPackages,
			[],
		);

		try {
			cd(repoRoot);
			await writeFile(join(pkg1Dir, 'fix.ts'), 'export const fixed = true;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: pkg1 latest fix"`.quiet();
			await writeFile(join(pkg1Dir, 'package.json'), JSON.stringify({ name: 'pkg1', version: '1.2.0' }, null, 2), 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "chore: release 1.2.0"`.quiet();
			await $`git tag pkg1@1.2.0`.quiet();
			await writeFile(join(pkg1Dir, 'post-tag.ts'), 'export const after = true;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: pkg1 after tag"`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		const firstCommit = await getFirstCommit(repoRoot);
		const allCommits = await getCommits(firstCommit, 'HEAD', repoPackages, repoRoot);
		await runChangelog(
			{
				changelog: {
					...defaultChangelogOptions,
					strategy: 'per-package',
					location: 'CHANGELOG.md',
				},
				git: {
					tagStrategy: 'package',
					tagTemplate: 'v%s',
				},
				root: repoRoot,
			},
			repoPackages,
			allCommits,
		);

		const pkg1Changelog = await readFile(join(pkg1Dir, 'CHANGELOG.md'), 'utf-8');
		expect(pkg1Changelog).toContain('## pkg1@1.2.0');
		expect(pkg1Changelog).toContain('Pkg1 latest fix');
		expect(pkg1Changelog).toContain('## pkg1@1.1.0');
		expect(pkg1Changelog).toContain('Pkg1 previous feature');
		expect(pkg1Changelog).not.toContain('Pkg1 after tag');
		const latestBlockStart = pkg1Changelog.indexOf('## pkg1@1.2.0');
		const previousBlockStart = pkg1Changelog.indexOf('## pkg1@1.1.0');
		expect(latestBlockStart).toBeGreaterThanOrEqual(0);
		expect(previousBlockStart).toBeGreaterThan(latestBlockStart);
		const latestBlock = pkg1Changelog.slice(latestBlockStart, previousBlockStart);
		expect(latestBlock).toContain('Pkg1 latest fix');
		expect(latestBlock).not.toContain('Pkg1 previous feature');
		expect(latestBlock).not.toContain('Pkg1 after tag');
	});
});
