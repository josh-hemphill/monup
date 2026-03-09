/**
 * Integration tests for package-based commit filtering
 * Verifies that commits are correctly mapped to packages for version bumping
 */

import type { ParsedCommit } from '@monup/git';
import type { PackageInfo } from '@monup/workspace';
import { filterCommitsByPackage } from '@monup/git';
import { describe, expect, it } from 'vitest';

/** Creates a mock package info */
function createPackage(name: string, path: string, root: string): PackageInfo {
	return {
		name,
		path,
		root,
		packageFile: `${path}/package.json`,
	};
}

/** Creates a mock parsed commit with package mapping */
function createCommit(
	hash: string,
	type: string,
	subject: string,
	packages?: string[],
): ParsedCommit {
	return {
		hash,
		message: `${type}: ${subject}`,
		author: 'Test <test@example.com>',
		date: '2024-01-01T00:00:00Z',
		type,
		subject,
		packages,
	};
}

describe('package-based commit filtering integration', () => {
	const root = '/workspace';
	const packages: PackageInfo[] = [
		createPackage('root-pkg', root, root),
		createPackage('@monup/cli', `${root}/packages/cli`, root),
		createPackage('@monup/git', `${root}/packages/git`, root),
		createPackage('@monup/version', `${root}/packages/version`, root),
	];

	describe('when commits have package mappings populated', () => {
		it('should assign commits to correct sub-packages based on packages field', () => {
			const commits: ParsedCommit[] = [
				createCommit('abc123', 'feat', 'add CLI feature', ['@monup/cli']),
				createCommit('def456', 'fix', 'fix git parser', ['@monup/git']),
				createCommit('ghi789', 'feat', 'version calculator', ['@monup/version']),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

			expect(scopedCommits.get('@monup/cli')?.length).toBe(1);
			expect(scopedCommits.get('@monup/cli')?.[0]?.hash).toBe('abc123');

			expect(scopedCommits.get('@monup/git')?.length).toBe(1);
			expect(scopedCommits.get('@monup/git')?.[0]?.hash).toBe('def456');

			expect(scopedCommits.get('@monup/version')?.length).toBe(1);
			expect(scopedCommits.get('@monup/version')?.[0]?.hash).toBe('ghi789');

			expect(scopedCommits.get('root-pkg')?.length).toBe(0);
			expect(unscopedCommits.size).toBe(0);
		});

		it('should assign commits touching multiple packages to all affected packages', () => {
			const commits: ParsedCommit[] = [
				createCommit('abc123', 'refactor', 'shared refactor', ['@monup/cli', '@monup/git']),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

			expect(scopedCommits.get('@monup/cli')?.length).toBe(1);
			expect(scopedCommits.get('@monup/git')?.length).toBe(1);
			expect(scopedCommits.get('@monup/version')?.length).toBe(0);
			expect(unscopedCommits.size).toBe(0);
		});

		it('should treat commits without packages field as unscoped', () => {
			const commits: ParsedCommit[] = [
				createCommit('abc123', 'chore', 'update root config', undefined),
				createCommit('def456', 'docs', 'update readme', []),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

			// Commits without packages are unscoped
			expect(unscopedCommits.size).toBe(2);

			// No packages should have these commits
			expect(scopedCommits.get('@monup/cli')?.length).toBe(0);
			expect(scopedCommits.get('@monup/git')?.length).toBe(0);
			expect(scopedCommits.get('@monup/version')?.length).toBe(0);
			expect(scopedCommits.get('root-pkg')?.length).toBe(0);
		});
	});

	describe('when commits lack package mappings (the bug scenario)', () => {
		it('should demonstrate the bug: all commits become unscoped without package mapping', () => {
			// This simulates what happens when getCommits() is called without packages parameter
			// The commits have no packages field populated
			const commitsWithoutPackageMapping: ParsedCommit[] = [
				createCommit('abc123', 'feat', 'add CLI feature', undefined),
				createCommit('def456', 'fix', 'fix git parser', undefined),
				createCommit('ghi789', 'feat', 'version calculator', undefined),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commitsWithoutPackageMapping, packages);

			// BUG: All commits are unscoped because packages field is undefined
			expect(unscopedCommits.size).toBe(3);

			// BUG: No sub-packages get any commits
			expect(scopedCommits.get('@monup/cli')?.length).toBe(0);
			expect(scopedCommits.get('@monup/git')?.length).toBe(0);
			expect(scopedCommits.get('@monup/version')?.length).toBe(0);
		});
	});

	describe('root package handling', () => {
		it('should allow root package to receive unscoped commits', () => {
			const commits: ParsedCommit[] = [
				createCommit('abc123', 'feat', 'sub-package feature', ['@monup/cli']),
				createCommit('def456', 'chore', 'root level change', undefined),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

			// Scoped commit goes to CLI
			expect(scopedCommits.get('@monup/cli')?.length).toBe(1);

			// Unscoped commit is in unscopedCommits set
			expect(unscopedCommits.size).toBe(1);
			expect([...unscopedCommits][0]?.hash).toBe('def456');

			// Root package check logic (from version.ts):
			// isRootPackage = pkg.path === '.' || pkg.path === pkg.root
			const rootPkg = packages.find((p) => p.path === p.root);
			expect(rootPkg?.name).toBe('root-pkg');
		});
	});

	describe('version bump scenarios', () => {
		it('should correctly filter commits for version calculation per package', () => {
			const commits: ParsedCommit[] = [
				// Feature for CLI - should bump CLI minor
				createCommit('abc123', 'feat', 'new cli command', ['@monup/cli']),
				// Fix for git - should bump git patch
				createCommit('def456', 'fix', 'parser edge case', ['@monup/git']),
				// Breaking change for version - should bump version major
				createCommit('ghi789', 'feat', 'breaking api change', ['@monup/version']),
				// Docs change - should not bump anything
				createCommit('jkl012', 'docs', 'update docs', ['@monup/cli']),
			];
			// Mark breaking change
			commits[2].breaking = true;

			const { scopedCommits } = filterCommitsByPackage(commits, packages);

			// CLI gets feat + docs commits
			const cliCommits = scopedCommits.get('@monup/cli') ?? [];
			expect(cliCommits.length).toBe(2);
			expect(cliCommits.some((c) => c.type === 'feat')).toBe(true);
			expect(cliCommits.some((c) => c.type === 'docs')).toBe(true);

			// Git gets fix commit
			const gitCommits = scopedCommits.get('@monup/git') ?? [];
			expect(gitCommits.length).toBe(1);
			expect(gitCommits[0]?.type).toBe('fix');

			// Version gets breaking feat commit
			const versionCommits = scopedCommits.get('@monup/version') ?? [];
			expect(versionCommits.length).toBe(1);
			expect(versionCommits[0]?.breaking).toBe(true);
		});
	});

	describe('has last tag path (per-package version filtering)', () => {
		const packagesWithChangelog: PackageInfo[] = [
			createPackage('root-pkg', root, root),
			createPackage('@monup/changelog', `${root}/packages/changelog`, root),
			createPackage('@monup/cli', `${root}/packages/cli`, root),
			createPackage('@monup/git', `${root}/packages/git`, root),
		];

		it('should give only changelog commits to changelog package when single commit touches only changelog', () => {
			// Simulates getCommits(lastPackageTag, undefined, packages) returning one commit
			// that changed root files + packages/changelog only → packages: ['@monup/changelog']
			const commits: ParsedCommit[] = [
				createCommit('abc123', 'feat', 'changelog formatting', ['@monup/changelog']),
			];

			const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packagesWithChangelog);

			expect(scopedCommits.get('@monup/changelog')?.length).toBe(1);
			expect(scopedCommits.get('@monup/changelog')?.[0]?.hash).toBe('abc123');

			expect(scopedCommits.get('@monup/cli')?.length).toBe(0);
			expect(scopedCommits.get('@monup/git')?.length).toBe(0);
			expect(unscopedCommits.size).toBe(0);
		});
	});
});
