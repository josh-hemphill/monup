import type { PackageInfo } from '../src/filter.ts';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { $, cd, fs, path } from 'zx';
import { getCommitsForPackage, getCommitsSinceLastTag } from '../src/index.ts';

describe('git workflow helpers', () => {
	let testDir: string;
	let testRepoDir: string;
	let packages: PackageInfo[];
	let rootPackage: PackageInfo;
	let pkg1: PackageInfo;
	let pkg2: PackageInfo;

	beforeAll(async () => {
		testDir = path.join(tmpdir(), `monup-git-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		testRepoDir = path.join(testDir, 'repo');
		await fs.mkdir(path.join(testRepoDir, 'packages', 'pkg1'), { recursive: true });
		await fs.mkdir(path.join(testRepoDir, 'packages', 'pkg2'), { recursive: true });

		const originalCwd = process.cwd();
		try {
			cd(testRepoDir);
			await $`git init`.quiet();
			await $`git config user.name "Test User"`.quiet();
			await $`git config user.email "test@example.com"`.quiet();
			await $`git config commit.gpgsign false`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'README.md'), '# Test\n', 'utf-8');
			await fs.writeFile(path.join(testRepoDir, 'packages', 'pkg1', 'package.json'), JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2), 'utf-8');
			await fs.writeFile(path.join(testRepoDir, 'packages', 'pkg2', 'package.json'), JSON.stringify({ name: 'pkg2', version: '1.0.0' }, null, 2), 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "chore: initial files"`.quiet();
			await $`git tag v1.0.0`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'packages', 'pkg1', 'index.ts'), 'export const pkg1 = 1;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat: add pkg1 feature"`.quiet();
			await $`git tag pkg1@1.0.0`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'packages', 'pkg2', 'index.ts'), 'export const pkg2 = 1;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: add pkg2 fix"`.quiet();
			await $`git tag pkg2@1.0.0`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'packages', 'pkg1', 'feature.ts'), 'export const another = 2;\n', 'utf-8');
			await fs.writeFile(path.join(testRepoDir, 'README.md'), '# Test Updated\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat: pkg1 and root update"`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'LICENSE'), 'MIT\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "docs: add root-only file"`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		rootPackage = { name: 'root', path: testRepoDir, root: testRepoDir };
		pkg1 = { name: 'pkg1', path: path.join(testRepoDir, 'packages', 'pkg1'), root: testRepoDir };
		pkg2 = { name: 'pkg2', path: path.join(testRepoDir, 'packages', 'pkg2'), root: testRepoDir };
		packages = [rootPackage, pkg1, pkg2];
	});

	afterAll(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it('gets commits since last global tag', async () => {
		const commits = await getCommitsSinceLastTag(
			{ tagStrategy: 'global', tagTemplate: 'v%s' },
			packages,
			testRepoDir,
		);

		expect(commits.length).toBeGreaterThanOrEqual(3);
	});

	it('gets commits since package tags when strategy is package', async () => {
		const commits = await getCommitsSinceLastTag(
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			packages,
			testRepoDir,
		);

		expect(commits.length).toBeGreaterThan(0);
		expect(commits.some((commit) => commit.packages?.includes('pkg1'))).toBe(true);
	});

	it('filters commits for a package with global strategy', async () => {
		const allCommits = await getCommitsSinceLastTag(
			{ tagStrategy: 'global', tagTemplate: 'v%s' },
			packages,
			testRepoDir,
		);

		const pkg1Commits = await getCommitsForPackage(
			pkg1,
			packages,
			allCommits,
			{ tagStrategy: 'global' },
			testRepoDir,
		);

		const pkg2Commits = await getCommitsForPackage(
			pkg2,
			packages,
			allCommits,
			{ tagStrategy: 'global' },
			testRepoDir,
		);

		expect(pkg1Commits.length).toBeGreaterThan(0);
		expect(pkg2Commits.length).toBeGreaterThan(0);
		expect(pkg1Commits.every((commit) => commit.packages?.includes('pkg1') === true)).toBe(true);
		expect(pkg2Commits.every((commit) => commit.packages?.includes('pkg2') === true)).toBe(true);
	});

	it('includes unscoped commits for root package', async () => {
		const allCommits = await getCommitsSinceLastTag(
			{ tagStrategy: 'global', tagTemplate: 'v%s' },
			packages,
			testRepoDir,
		);

		const rootCommits = await getCommitsForPackage(
			rootPackage,
			packages,
			allCommits,
			{ tagStrategy: 'global' },
			testRepoDir,
		);

		expect(rootCommits.length).toBeGreaterThan(0);
	});
});
