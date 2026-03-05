/**
 * Test cases for git package
 * These tests exercise shell command operations and verify their outputs.
 * Console output from the underlying functions is captured and can be inspected.
 */

import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { $, cd, fs, path } from 'zx';
import { createCommit, getCommits, getCurrentBranch, getFirstCommit, getGitHubRepo, getLastTag, isPrerelease } from '../src/index.ts';
import { mockPackages } from './mock.ts';

describe('git package - shell command test cases', () => {
	let testDir: string;
	let testRepoDir: string;

	beforeAll(async() => {
		testDir = path.join(tmpdir(), `monup-git-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		testRepoDir = path.join(testDir, 'repo');
		await fs.mkdir(testRepoDir, { recursive: true });

		const originalCwd = process.cwd();
		try {
			cd(testRepoDir);

			// Initialize git repo
			await $`git init`.quiet();
			await $`git config user.name "Test User"`.quiet();
			await $`git config user.email "test@example.com"`.quiet();
			await $`git config commit.gpgsign false`.quiet();

			// Create initial commit
			await fs.writeFile(path.join(testRepoDir, 'README.md'), '# Test Repo\n', 'utf-8');
			await fs.writeFile(path.join(testRepoDir, 'package.json'), JSON.stringify({
				name: 'test-package',
				version: '1.0.0',
			}, null, 2), 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat: initial commit"`.quiet();

			// Create a few more commits
			await fs.mkdir(path.join(testRepoDir, 'src'), { recursive: true });
			await fs.writeFile(path.join(testRepoDir, 'src', 'index.ts'), 'export const version = "1.0.0";\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "feat: add source file"`.quiet();

			await fs.writeFile(path.join(testRepoDir, 'src', 'utils.ts'), 'export function helper() {}\n', 'utf-8');
			await $`git add .`.quiet();
			await $`git commit -m "fix: add utility function"`.quiet();

			// Create some tags
			await $`git tag v1.0.0`.quiet();
			await $`git tag v1.1.0`.quiet();
		}
		finally {
			cd(originalCwd);
		}
	});

	afterAll(async() => {
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		}
		catch {
			// Ignore cleanup errors
		}
	});
	it('should get commits from HEAD', async() => {
		const commits = await getCommits(undefined, undefined, mockPackages, testRepoDir);
		expect(Array.isArray(commits)).toBe(true);
		expect(commits.length).toBeGreaterThan(0);
		expect(typeof commits[0]?.hash).toBe('string');
		expect(commits[0]?.hash.length).toBeGreaterThanOrEqual(7);
	});

	it('should get commits without package info', async() => {
		const commits = await getCommits(undefined, undefined, undefined, testRepoDir);
		expect(Array.isArray(commits)).toBe(true);
		expect(commits.length).toBeGreaterThan(0);
		expect(typeof commits[0]?.hash).toBe('string');
	});

	it('should get current branch', async() => {
		const branch = await getCurrentBranch(testRepoDir);
		expect(typeof branch).toBe('string');
		expect(branch.length).toBeGreaterThan(0);
	});

	it('should get last tag with default filter', async() => {
		const lastTag = await getLastTag(undefined, undefined, undefined, testRepoDir);
		expect(lastTag).toBeDefined();
		expect(typeof lastTag).toBe('string');
		const tag = lastTag as string;
		expect(tag.length).toBeGreaterThan(0);
	});

	it('should get last tag with custom filter', async() => {
		const lastTag = await getLastTag(undefined, undefined, (tag) => tag.startsWith('v'), testRepoDir);
		expect(lastTag).toBeDefined();
		expect(typeof lastTag).toBe('string');
		const tag = lastTag as string;
		expect(tag.startsWith('v')).toBe(true);
	});

	it('should get last tag with template', async() => {
		const lastTag = await getLastTag(undefined, 'v%s', undefined, testRepoDir);
		expect(lastTag).toBeDefined();
		expect(typeof lastTag).toBe('string');
		const tag = lastTag as string;
		expect(tag.length).toBeGreaterThan(0);
	});

	it('should get first commit', async() => {
		const firstCommit = await getFirstCommit(testRepoDir);
		expect(firstCommit).toBeDefined();
		expect(typeof firstCommit).toBe('string');
		const commit = firstCommit as string;
		expect(commit.length).toBeGreaterThanOrEqual(7);
	});

	it('should get GitHub repository info', async() => {
		// This test may not work with temporary repo, so we'll skip the assertion if undefined
		const repo = await getGitHubRepo('github.com', testRepoDir);
		// Temporary repo won't have a remote, so this will be undefined
		// We just verify the function doesn't throw
		if (repo !== undefined) {
			expect(typeof repo).toBe('string');
			const repository = repo;
			expect(repository.length).toBeGreaterThan(0);
			expect(repository.includes('/')).toBe(true);
		}
	});

	it('should create commit with pathspec normalization', async() => {
		await fs.writeFile(path.join(testRepoDir, 'package.json'), JSON.stringify({
			name: 'test-package',
			version: '1.0.1',
		}, null, 2), 'utf-8');
		// createCommit uses spawn (no shell) and normalizes paths; cwd ensures git runs in repo
		await createCommit('chore: bump version', ['package.json'], false, true, testRepoDir);
		const lastCommit = await $({ cwd: testRepoDir })`git log -1 --format=%s`.quiet();
		expect(lastCommit.stdout.trim()).toBe('chore: bump version');
	});

	it('should detect prerelease branches', () => {
		const testBranches = ['main', 'beta', 'alpha-1', 'rc-2', 'dev', 'feature-beta', 'pre-release'];
		const results = testBranches.map((branch) => ({ branch, isPrerelease: isPrerelease(branch) }));

		expect(results.find((r) => r.branch === 'main')?.isPrerelease).toBe(false);
		expect(results.find((r) => r.branch === 'beta')?.isPrerelease).toBe(true);
		expect(results.find((r) => r.branch === 'alpha-1')?.isPrerelease).toBe(true);
		expect(results.find((r) => r.branch === 'rc-2')?.isPrerelease).toBe(true);
		expect(results.find((r) => r.branch === 'dev')?.isPrerelease).toBe(true);
		expect(results.find((r) => r.branch === 'feature-beta')?.isPrerelease).toBe(true);
		expect(results.find((r) => r.branch === 'pre-release')?.isPrerelease).toBe(true);
	});
});
