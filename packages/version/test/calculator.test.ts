import type { ParsedCommit } from '@monup/git';
import { describe, expect, it } from 'vitest';
import { calculateBumpType, calculateNextVersion } from '../src/calculator.ts';

describe('calculateBumpType', () => {
	it('should return undefined for empty commits', () => {
		const result = calculateBumpType([]);
		expect(result).toBeUndefined();
	});

	it('should return patch for fix commits', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'fix: resolve bug',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'resolve bug',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('patch');
	});

	it('should return minor for feat commits', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'feat: add feature',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'add feature',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('minor');
	});

	it('should return major for breaking changes', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'feat: breaking change',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'breaking change',
				breaking: true,
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('major');
	});

	it('should return major when breaking change appears with other commits', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'fix: bug fix',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'bug fix',
			},
			{
				hash: 'def456',
				message: 'feat: breaking change',
				author: 'test',
				date: '2024-01-02',
				type: 'feat',
				subject: 'breaking change',
				breaking: true,
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('major');
	});

	it('should prioritize minor over patch', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'fix: bug fix',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'bug fix',
			},
			{
				hash: 'def456',
				message: 'feat: new feature',
				author: 'test',
				date: '2024-01-02',
				type: 'feat',
				subject: 'new feature',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('minor');
	});

	it('should return undefined for non-versioned commit types', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'docs: update readme',
				author: 'test',
				date: '2024-01-01',
				type: 'docs',
				subject: 'update readme',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBeUndefined();
	});

	it('should use custom type mapping', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'custom: custom type',
				author: 'test',
				date: '2024-01-01',
				type: 'custom',
				subject: 'custom type',
			},
		];
		const customMapping = { custom: 'minor' as const };
		const result = calculateBumpType(commits, customMapping);
		expect(result).toBe('minor');
	});

	it('should handle perf commits as patch', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'perf: improve performance',
				author: 'test',
				date: '2024-01-01',
				type: 'perf',
				subject: 'improve performance',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('patch');
	});

	it('should handle refactor commits as patch', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'refactor: restructure code',
				author: 'test',
				date: '2024-01-01',
				type: 'refactor',
				subject: 'restructure code',
			},
		];
		const result = calculateBumpType(commits);
		expect(result).toBe('patch');
	});
});

describe('calculateNextVersion', () => {
	it('should increment patch version', () => {
		const result = calculateNextVersion('1.2.3', 'patch');
		expect(result).toBe('1.2.4');
	});

	it('should increment minor version', () => {
		const result = calculateNextVersion('1.2.3', 'minor');
		expect(result).toBe('1.3.0');
	});

	it('should increment major version', () => {
		const result = calculateNextVersion('1.2.3', 'major');
		expect(result).toBe('2.0.0');
	});

	it('should return undefined for invalid version', () => {
		const result = calculateNextVersion('invalid', 'patch');
		expect(result).toBeUndefined();
	});

	it('should handle prerelease version', () => {
		const result = calculateNextVersion('1.2.3', 'prerelease', 'beta');
		expect(result).toBe('1.2.4-beta.0');
	});

	it('should handle version with v prefix', () => {
		const result = calculateNextVersion('v1.2.3', 'patch');
		expect(result).toBe('1.2.4');
	});

	it('should handle zero version', () => {
		const result = calculateNextVersion('0.0.0', 'patch');
		expect(result).toBe('0.0.1');
	});
});
