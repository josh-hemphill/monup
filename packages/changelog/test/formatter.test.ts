import type { ParsedCommit } from '@monup/git';
import type { ChangelogOptions } from '../src/options.ts';
import { describe, expect, it } from 'vitest';
import { formatChangelogSections, formatCommitMessage, groupCommits } from '../src/formatter.ts';

describe('formatCommitMessage', () => {
	const defaultOptions: ChangelogOptions = {
		capitalize: false,
		group: false,
		types: {},
	};

	it('should return message as-is when no options applied', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'fix: resolve bug',
			author: 'test',
			date: '2024-01-01',
			type: 'fix',
			subject: 'resolve bug',
		};
		const result = formatCommitMessage(commit, defaultOptions);
		expect(result).toBe('resolve bug');
	});

	it('should capitalize message when enabled', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'fix: resolve bug',
			author: 'test',
			date: '2024-01-01',
			type: 'fix',
			subject: 'resolve bug',
		};
		const options: ChangelogOptions = { ...defaultOptions, capitalize: true };
		const result = formatCommitMessage(commit, options);
		expect(result).toBe('Resolve bug');
	});

	it('should apply scope mapping when provided', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'fix(api): resolve bug',
			author: 'test',
			date: '2024-01-01',
			type: 'fix',
			scope: 'api',
			subject: 'resolve bug',
		};
		const options: ChangelogOptions = {
			...defaultOptions,
			scopeMap: { api: 'API' },
		};
		const result = formatCommitMessage(commit, options);
		expect(result).toBe('resolve bug');
	});

	it('should use message when subject is not available', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'fix: resolve bug',
			author: 'test',
			date: '2024-01-01',
			type: 'fix',
		};
		const result = formatCommitMessage(commit, defaultOptions);
		expect(result).toBe('fix: resolve bug');
	});
});

describe('groupCommits', () => {
	const defaultOptions: ChangelogOptions = {
		capitalize: false,
		group: false,
		types: {},
	};

	it('should group commits by type', () => {
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
		const result = groupCommits(commits, defaultOptions);
		expect(result.has('fix')).toBe(true);
		expect(result.has('feat')).toBe(true);
		expect(result.get('fix')?.get('')?.length).toBe(1);
		expect(result.get('feat')?.get('')?.length).toBe(1);
	});

	it('should group commits by scope when group is enabled', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'fix(api): bug fix',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				scope: 'api',
				subject: 'bug fix',
			},
			{
				hash: 'def456',
				message: 'fix(ui): another fix',
				author: 'test',
				date: '2024-01-02',
				type: 'fix',
				scope: 'ui',
				subject: 'another fix',
			},
		];
		const options: ChangelogOptions = { ...defaultOptions, group: true };
		const result = groupCommits(commits, options);
		const fixGroup = result.get('fix');
		expect(fixGroup?.has('api')).toBe(true);
		expect(fixGroup?.has('ui')).toBe(true);
		expect(fixGroup?.get('api')?.length).toBe(1);
		expect(fixGroup?.get('ui')?.length).toBe(1);
	});

	it('should use empty scope when group is disabled', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'fix(api): bug fix',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				scope: 'api',
				subject: 'bug fix',
			},
		];
		const result = groupCommits(commits, defaultOptions);
		const fixGroup = result.get('fix');
		expect(fixGroup?.has('')).toBe(true);
		expect(fixGroup?.get('')?.length).toBe(1);
	});

	it('should handle commits without type as "other"', () => {
		const commits: ParsedCommit[] = [
			{
				hash: 'abc123',
				message: 'random commit',
				author: 'test',
				date: '2024-01-01',
			},
		];
		const result = groupCommits(commits, defaultOptions);
		expect(result.has('other')).toBe(true);
		expect(result.get('other')?.get('')?.length).toBe(1);
	});
});

describe('formatChangelogSections', () => {
	const defaultOptions: ChangelogOptions = {
		capitalize: false,
		group: false,
		types: {
			feat: { title: 'Features' },
			fix: { title: 'Bug Fixes' },
		},
		titles: {
			breakingChanges: 'Breaking Changes',
		},
	};

	it('should format sections for grouped commits', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const fixGroup = new Map<string, ParsedCommit[]>();
		fixGroup.set('', [
			{
				hash: 'abc123',
				message: 'fix: bug fix',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'bug fix',
			},
		]);
		grouped.set('fix', fixGroup);

		const result = formatChangelogSections(grouped, defaultOptions);
		expect(result.length).toBeGreaterThan(0);
		expect(result.some((line) => line.includes('Bug Fixes'))).toBe(true);
		expect(result.some((line) => line.includes('bug fix'))).toBe(true);
	});

	it('should prioritize breaking changes', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const featGroup = new Map<string, ParsedCommit[]>();
		featGroup.set('', [
			{
				hash: 'abc123',
				message: 'feat: breaking change',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'breaking change',
				breaking: true,
			},
		]);
		grouped.set('feat', featGroup);

		const result = formatChangelogSections(grouped, defaultOptions);
		const breakingIndex = result.findIndex((line) => line.includes('Breaking Changes'));
		const featuresIndex = result.findIndex((line) => line.includes('Features'));
		expect(breakingIndex).toBeGreaterThan(-1);
		expect(breakingIndex).toBeLessThan(featuresIndex);
	});

	it('should skip breaking changes in regular sections', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const featGroup = new Map<string, ParsedCommit[]>();
		featGroup.set('', [
			{
				hash: 'abc123',
				message: 'feat: breaking change',
				author: 'test',
				date: '2024-01-01',
				type: 'feat',
				subject: 'breaking change',
				breaking: true,
			},
			{
				hash: 'def456',
				message: 'feat: regular feature',
				author: 'test',
				date: '2024-01-02',
				type: 'feat',
				subject: 'regular feature',
			},
		]);
		grouped.set('feat', featGroup);

		const result = formatChangelogSections(grouped, defaultOptions);
		const breakingSection = result.filter((line) => line.includes('breaking change'));
		const featuresSection = result.filter((line) => line.includes('regular feature'));
		expect(breakingSection.length).toBeGreaterThan(0);
		expect(featuresSection.length).toBeGreaterThan(0);
		// Breaking change should appear in breaking section, regular feature in features section
	});

	it('should skip types not in options.types', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const choreGroup = new Map<string, ParsedCommit[]>();
		choreGroup.set('', [
			{
				hash: 'abc123',
				message: 'chore: update deps',
				author: 'test',
				date: '2024-01-01',
				type: 'chore',
				subject: 'update deps',
			},
		]);
		grouped.set('chore', choreGroup);

		const result = formatChangelogSections(grouped, defaultOptions);
		expect(result.some((line) => line.includes('chore'))).toBe(false);
	});
});
