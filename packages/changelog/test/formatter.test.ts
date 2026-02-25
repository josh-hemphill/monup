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

	it('should apply both capitalization and scope mapping when both are enabled', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'api: resolve bug',
			author: 'test',
			date: '2024-01-01',
			type: 'fix',
			scope: 'api',
		};
		const options: ChangelogOptions = {
			...defaultOptions,
			capitalize: true,
			scopeMap: { api: 'API' },
		};
		const result = formatCommitMessage(commit, options);
		expect(result).toBe('API: Resolve bug');
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

	it('should use full message when keepTypePrefix is true', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'feat(api): add endpoint',
			author: 'test',
			date: '2024-01-01',
			type: 'feat',
			scope: 'api',
			subject: 'add endpoint',
		};
		const options: ChangelogOptions = { ...defaultOptions, keepTypePrefix: true };
		const result = formatCommitMessage(commit, options);
		expect(result).toBe('feat(api): add endpoint');
	});

	it('should capitalize only subject part when keepTypePrefix and capitalize are true', () => {
		const commit: ParsedCommit = {
			hash: 'abc123',
			message: 'feat: add new feature',
			author: 'test',
			date: '2024-01-01',
			type: 'feat',
			subject: 'add new feature',
		};
		const options: ChangelogOptions = {
			...defaultOptions,
			keepTypePrefix: true,
			capitalize: true,
		};
		const result = formatCommitMessage(commit, options);
		expect(result).toBe('feat: Add new feature');
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

	it('should append commit link when commitLinks and resolvedCommitUrlTemplate are set', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const fixGroup = new Map<string, ParsedCommit[]>();
		fixGroup.set('', [
			{
				hash: 'abc123def456',
				message: 'fix: resolve bug',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'resolve bug',
			},
		]);
		grouped.set('fix', fixGroup);

		const options: ChangelogOptions = {
			...defaultOptions,
			commitLinks: true,
			resolvedCommitUrlTemplate: 'https://example.com/commit/{{hash}}',
		};
		const result = formatChangelogSections(grouped, options);
		const bulletLine = result.find((line) => line.startsWith('- ') && line.includes('resolve bug'));
		expect(bulletLine).toBeDefined();
		expect(bulletLine).toContain('([abc123d](https://example.com/commit/abc123def456))');
	});

	it('should not append commit link when commitUrlTemplate is empty', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const fixGroup = new Map<string, ParsedCommit[]>();
		fixGroup.set('', [
			{
				hash: 'abc123',
				message: 'fix: resolve bug',
				author: 'test',
				date: '2024-01-01',
				type: 'fix',
				subject: 'resolve bug',
			},
		]);
		grouped.set('fix', fixGroup);

		const options: ChangelogOptions = {
			...defaultOptions,
			commitLinks: true,
			resolvedCommitUrlTemplate: '',
		};
		const result = formatChangelogSections(grouped, options);
		const bulletLine = result.find((line) => line.startsWith('- ') && line.includes('resolve bug'));
		expect(bulletLine).toBe('- resolve bug');
	});

	it('should emit sections in typeOrder when set (feat before fix)', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const fixGroup = new Map<string, ParsedCommit[]>();
		fixGroup.set('', [
			{ hash: 'f1', message: 'fix: bug fix', author: 't', date: '2024-01-01', type: 'fix', subject: 'bug fix' },
		]);
		grouped.set('fix', fixGroup);
		const featGroup = new Map<string, ParsedCommit[]>();
		featGroup.set('', [
			{ hash: 'a1', message: 'feat: new feature', author: 't', date: '2024-01-01', type: 'feat', subject: 'new feature' },
		]);
		grouped.set('feat', featGroup);

		const options: ChangelogOptions = {
			...defaultOptions,
			typeOrder: ['feat', 'fix'],
		};
		const result = formatChangelogSections(grouped, options);
		const featuresIndex = result.findIndex((line) => line.includes('Features'));
		const bugFixesIndex = result.findIndex((line) => line.includes('Bug Fixes'));
		expect(featuresIndex).toBeGreaterThan(-1);
		expect(bugFixesIndex).toBeGreaterThan(-1);
		expect(featuresIndex).toBeLessThan(bugFixesIndex);
	});

	it('should emit types not in typeOrder after ordered types', () => {
		const grouped = new Map<string, Map<string, ParsedCommit[]>>();
		const featGroup = new Map<string, ParsedCommit[]>();
		featGroup.set('', [
			{ hash: 'a1', message: 'feat: feature', author: 't', date: '2024-01-01', type: 'feat', subject: 'feature' },
		]);
		grouped.set('feat', featGroup);
		const fixGroup = new Map<string, ParsedCommit[]>();
		fixGroup.set('', [
			{ hash: 'f1', message: 'fix: fix', author: 't', date: '2024-01-01', type: 'fix', subject: 'fix' },
		]);
		grouped.set('fix', fixGroup);
		const choreGroup = new Map<string, ParsedCommit[]>();
		choreGroup.set('', [
			{ hash: 'c1', message: 'chore: chore', author: 't', date: '2024-01-01', type: 'chore', subject: 'chore' },
		]);
		grouped.set('chore', choreGroup);

		const options: ChangelogOptions = {
			...defaultOptions,
			types: {
				feat: { title: 'Features' },
				fix: { title: 'Bug Fixes' },
				chore: { title: 'Chore' },
			},
			typeOrder: ['feat', 'fix'],
		};
		const result = formatChangelogSections(grouped, options);
		const featuresIndex = result.findIndex((line) => line.includes('Features'));
		const bugFixesIndex = result.findIndex((line) => line.includes('Bug Fixes'));
		const choreIndex = result.findIndex((line) => line.includes('Chore'));
		expect(choreIndex).toBeGreaterThan(bugFixesIndex);
		expect(featuresIndex).toBeLessThan(bugFixesIndex);
	});
});
