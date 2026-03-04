import type { PackageInfo } from '@monup/workspace';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { $, cd, fs, path } from 'zx';
import { getCommitsForPackage, getCommitsSinceLastTag } from '@monup/git';
import { calculateBumpType } from '../src/calculator.ts';
import { runVersionBump } from '../src/index.ts';

interface RepoContext {
	testDir: string;
	repoDir: string;
	pkg1: PackageInfo;
	pkg2: PackageInfo;
	packages: PackageInfo[];
	pkg1File: string;
	pkg2File: string;
}

async function createTwoPackageRepo(): Promise<RepoContext> {
	const testDir = path.join(tmpdir(), `monup-version-package-tags-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	const repoDir = path.join(testDir, 'repo');
	const pkg1Dir = path.join(repoDir, 'packages', 'pkg1');
	const pkg2Dir = path.join(repoDir, 'packages', 'pkg2');
	const pkg1File = path.join(pkg1Dir, 'package.json');
	const pkg2File = path.join(pkg2Dir, 'package.json');
	await fs.mkdir(pkg1Dir, { recursive: true });
	await fs.mkdir(pkg2Dir, { recursive: true });
	await fs.writeFile(pkg1File, JSON.stringify({ name: 'pkg1', version: '1.0.0' }, null, 2), 'utf-8');
	await fs.writeFile(pkg2File, JSON.stringify({ name: 'pkg2', version: '1.0.0' }, null, 2), 'utf-8');
	await fs.writeFile(path.join(repoDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n', 'utf-8');

	const originalCwd = process.cwd();
	try {
		cd(repoDir);
		await $`git init`.quiet();
		await $`git config user.name "Test User"`.quiet();
		await $`git config user.email "test@example.com"`.quiet();
		await $`git config commit.gpgsign false`.quiet();
		await $`git add .`.quiet();
		await $`git commit -m "chore: initial packages"`.quiet();
		await $`git tag pkg1@1.0.0`.quiet();
		await $`git tag pkg2@1.0.0`.quiet();
	}
	finally {
		cd(originalCwd);
	}

	const pkg1: PackageInfo = { name: 'pkg1', path: pkg1Dir, root: repoDir, packageFile: pkg1File };
	const pkg2: PackageInfo = { name: 'pkg2', path: pkg2Dir, root: repoDir, packageFile: pkg2File };

	return {
		testDir,
		repoDir,
		pkg1,
		pkg2,
		packages: [pkg1, pkg2],
		pkg1File,
		pkg2File,
	};
}

describe('runVersionBump package tag behavior', () => {
	const createdDirs: string[] = [];

	afterEach(async () => {
		while (createdDirs.length > 0) {
			const dir = createdDirs.pop();
			if (typeof dir === 'string') {
				await fs.rm(dir, { recursive: true, force: true });
			}
		}
	});

	it('bumps only touched package by patch for a single scoped fix commit', async () => {
		const context = await createTwoPackageRepo();
		createdDirs.push(context.testDir);

		const originalCwd = process.cwd();
		try {
			cd(context.repoDir);
			await fs.writeFile(path.join(context.repoDir, 'packages', 'pkg1', 'index.ts'), 'export const value = 1;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix(pkg1): handle edge case"`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		const commits = await getCommitsSinceLastTag(
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			context.packages,
			context.repoDir,
		);
		expect(commits.length).toBe(1);
		expect(commits[0]?.packages).toEqual(['pkg1']);

		const pkg1Commits = await getCommitsForPackage(
			context.pkg1,
			context.packages,
			commits,
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			context.repoDir,
		);
		const pkg2Commits = await getCommitsForPackage(
			context.pkg2,
			context.packages,
			commits,
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			context.repoDir,
		);

		expect(pkg1Commits.length).toBe(1);
		expect(pkg2Commits.length).toBe(0);
		expect(calculateBumpType(pkg1Commits)).toBe('patch');

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
					tagStrategy: 'package',
					tagTemplate: 'v%s',
				},
			},
			context.packages,
			{
				workspaceRoot: context.repoDir,
				commits,
			},
		);

		const pkg1Json = JSON.parse(await fs.readFile(context.pkg1File, 'utf-8')) as { version: string };
		const pkg2Json = JSON.parse(await fs.readFile(context.pkg2File, 'utf-8')) as { version: string };
		expect(pkg1Json.version).toBe('1.0.1');
		expect(pkg2Json.version).toBe('1.0.0');
	});

	it('does not let unrelated feat commits leak into another package bump type', async () => {
		const context = await createTwoPackageRepo();
		createdDirs.push(context.testDir);

		const originalCwd = process.cwd();
		try {
			cd(context.repoDir);

			await fs.writeFile(path.join(context.repoDir, 'packages', 'pkg2', 'feature.ts'), 'export const feature = true;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat(pkg2): add new feature"`.quiet();

			await fs.writeFile(path.join(context.repoDir, 'packages', 'pkg1', 'fix.ts'), 'export const fixed = true;\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix(pkg1): fix behavior"`.quiet();
		}
		finally {
			cd(originalCwd);
		}

		const commits = await getCommitsSinceLastTag(
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			context.packages,
			context.repoDir,
		);

		const pkg1Commits = await getCommitsForPackage(
			context.pkg1,
			context.packages,
			commits,
			{ tagStrategy: 'package', tagTemplate: 'v%s' },
			context.repoDir,
		);

		expect(pkg1Commits.length).toBe(1);
		expect(pkg1Commits[0]?.type).toBe('fix');
		expect(pkg1Commits[0]?.packages).toEqual(['pkg1']);
		expect(calculateBumpType(pkg1Commits)).toBe('patch');
	});
});
