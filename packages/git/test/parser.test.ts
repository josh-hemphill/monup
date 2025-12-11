import { describe, expect, it } from 'vitest';
import { parseConventionalCommit, parseGitLog } from '../src/parser.ts';

describe('parseConventionalCommit', () => {
	it('should parse simple conventional commit', () => {
		const result = parseConventionalCommit('feat: add new feature');
		expect(result.type).toBe('feat');
		expect(result.subject).toBe('add new feature');
		expect(result.breaking).toBe(false);
	});

	it('should parse commit with scope', () => {
		const result = parseConventionalCommit('fix(api): resolve bug');
		expect(result.type).toBe('fix');
		expect(result.scope).toBe('api');
		expect(result.subject).toBe('resolve bug');
	});

	it('should detect breaking change with exclamation mark', () => {
		const result = parseConventionalCommit('feat!: breaking change');
		expect(result.breaking).toBe(true);
	});

	it('should detect breaking change with BREAKING CHANGE in message', () => {
		const result = parseConventionalCommit('feat: add feature\n\nBREAKING CHANGE: breaks API');
		expect(result.breaking).toBe(true);
	});

	it('should handle non-conventional commit', () => {
		const result = parseConventionalCommit('random commit message');
		expect(result.type).toBeUndefined();
		expect(result.subject).toBe('random commit message');
		expect(result.breaking).toBe(false);
	});

	it('should handle commit with exclamation in type', () => {
		const result = parseConventionalCommit('feat!: breaking change');
		expect(result.breaking).toBe(true);
	});

	it('should trim subject whitespace', () => {
		const result = parseConventionalCommit('feat:  add feature  ');
		expect(result.subject).toBe('add feature');
	});
});

describe('parseGitLog', () => {
	it('should parse git log output', () => {
		const output = 'abc123|John Doe|john@example.com|2024-01-01|feat: add feature|body text';
		const result = parseGitLog(output);
		expect(result.length).toBe(1);
		expect(result[0]?.hash).toBe('abc123');
		expect(result[0]?.author).toBe('John Doe <john@example.com>');
		expect(result[0]?.type).toBe('feat');
		expect(result[0]?.subject).toBe('add feature');
	});

	it('should parse multiple commits', () => {
		const output = `abc123|John|john@example.com|2024-01-01|feat: feature|
def456|Jane|jane@example.com|2024-01-02|fix: bug|`;
		const result = parseGitLog(output);
		expect(result.length).toBe(2);
		expect(result[0]?.type).toBe('feat');
		expect(result[1]?.type).toBe('fix');
	});

	it('should handle commits with body', () => {
		const output = 'abc123|John|john@example.com|2024-01-01|feat: feature|body|line|two';
		const result = parseGitLog(output);
		expect(result[0]?.body).toBe('body|line|two');
	});

	it('should skip empty lines', () => {
		const output = `abc123|John|john@example.com|2024-01-01|feat: feature|

def456|Jane|jane@example.com|2024-01-02|fix: bug|`;
		const result = parseGitLog(output);
		expect(result.length).toBe(2);
	});

	it('should skip invalid lines', () => {
		const output = `abc123|John|john@example.com|2024-01-01|feat: feature|
invalid line
def456|Jane|jane@example.com|2024-01-02|fix: bug|`;
		const result = parseGitLog(output);
		expect(result.length).toBe(2);
	});

	it('should parse breaking changes', () => {
		const output = 'abc123|John|john@example.com|2024-01-01|feat!: breaking change|';
		const result = parseGitLog(output);
		expect(result[0]?.breaking).toBe(true);
	});
});
