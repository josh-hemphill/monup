import type { ParsedCommit } from '../src/parser.ts';
import { describe, expect, it } from 'vitest';
import { filterCommitsByPackage } from '../src/filter.ts';

describe('filterCommitsByPackage', () => {
	it('should filter commits by package', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'feat: feature for pkg1',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'feature for pkg1',
				packages: ['package1'],
			},
			{
				hash: 'def456',
				message: 'fix: fix for pkg2',
				author: 'test',
				date: '2024-01-02',
				type: 'fix',
				subject: 'fix for pkg2',
				packages: ['package2'],
			},
			{
				hash: 'ghi789',
				message: 'feat: feature for both',
				author: 'test',
				date: '2024-01-03',
				type: 'feat',
				subject: 'feature for both',
				packages: ['package1', 'package2'],
			},
		];

		const packages = [
			{ name: 'package1', path: '/packages/pkg1', root: '/' },
			{ name: 'package2', path: '/packages/pkg2', root: '/' },
		];

		const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

		expect(scopedCommits.size).toBe(2);
		expect(scopedCommits.get('package1')?.length).toBe(2);
		expect(scopedCommits.get('package2')?.length).toBe(2);

		const pkg1Commits = scopedCommits.get('package1');
		expect(pkg1Commits?.some((c) => c.hash === 'abc123')).toBe(true);
		expect(pkg1Commits?.some((c) => c.hash === 'ghi789')).toBe(true);

		const pkg2Commits = scopedCommits.get('package2');
		expect(pkg2Commits?.some((c) => c.hash === 'def456')).toBe(true);
		expect(pkg2Commits?.some((c) => c.hash === 'ghi789')).toBe(true);

		expect(unscopedCommits.size).toBe(0);
	});

	it('should skip commits without package info', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'feat: feature',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'feature',
				packages: ['package1'],
			},
			{
				hash: 'def456',
				message: 'docs: update readme',
				author: 'test',
				date: '2024-01-02',
				type: 'docs',
				subject: 'update readme',
				// No packages field
			},
		];

		const packages = [
			{ name: 'package1', path: '/packages/pkg1', root: '/' },
		];

		const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

		expect(scopedCommits.size).toBe(1);
		expect(scopedCommits.get('package1')?.length).toBe(1);
		expect(scopedCommits.get('package1')?.[0]?.hash).toBe('abc123');

		expect(unscopedCommits.size).toBe(1);
		expect([...unscopedCommits][0]?.hash).toBe('def456');
	});

	it('should initialize empty arrays for all packages', () => {
		const commits: ParsedCommit[] = [];

		const packages = [
			{ name: 'package1', path: '/packages/pkg1', root: '/' },
			{ name: 'package2', path: '/packages/pkg2', root: '/' },
		];

		const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

		expect(scopedCommits.size).toBe(2);
		expect(scopedCommits.get('package1')?.length).toBe(0);
		expect(scopedCommits.get('package2')?.length).toBe(0);

		expect(unscopedCommits.size).toBe(0);
	});

	it('should handle commits that touch multiple packages', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'feat: shared feature',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'shared feature',
				packages: ['package1', 'package2', 'package3'],
			},
		];

		const packages = [
			{ name: 'package1', path: '/packages/pkg1', root: '/' },
			{ name: 'package2', path: '/packages/pkg2', root: '/' },
			{ name: 'package3', path: '/packages/pkg3', root: '/' },
		];

		const { scopedCommits, unscopedCommits } = filterCommitsByPackage(commits, packages);

		expect(scopedCommits.get('package1')?.length).toBe(1);
		expect(scopedCommits.get('package2')?.length).toBe(1);
		expect(scopedCommits.get('package3')?.length).toBe(1);
		expect(scopedCommits.get('package1')?.[0]?.hash).toBe('abc123');
		expect(scopedCommits.get('package2')?.[0]?.hash).toBe('abc123');
		expect(scopedCommits.get('package3')?.[0]?.hash).toBe('abc123');

		expect(unscopedCommits.size).toBe(0);
	});
});
