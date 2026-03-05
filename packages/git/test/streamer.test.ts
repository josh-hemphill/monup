import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamGitCommits } from '../src/streamer.ts';
import { mockPackages, root } from './mock.ts';

function createCommit(
	hash: string,
	author: string,
	email: string,
	date: string,
	subject: string,
	body?: string,
	files?: string[],
): string {
	const filesString = files?.join('\n') ?? '';
	return `${hash}|${author}|${email}|${date}|${subject}|${body ?? ''}${filesString ? `\n${filesString}` : ''}`;
}

/**
 * Creates a mock readable stream from string chunks
 */
function createMockStream(chunks: string[]): NodeJS.ReadableStream {
	const readable = new Readable({
		read() {
			for (const chunk of chunks) {
				this.push(Buffer.from(chunk, 'utf-8'));
			}
			this.push(null); // End stream
		},
	});
	return readable;
}

describe('streamGitCommits', () => {
	it('should parse single commit with files', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: add feature',
			'body text',
			['packages/pkg1/file1.ts', 'packages/pkg1/file2.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { hash?: string; packages?: string[]; type?: string };
		expect(commit.hash).toBe('abc123def4567890123456789012345678901234');
		expect(commit.packages).toEqual(['package1']);
		expect(commit.type).toBe('feat');
	});

	it('should parse multiple commits with different packages', async() => {
		const commit1 = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: pkg1 feature',
			undefined,
			['packages/pkg1/file.ts'],
		);
		/*
			This commit has an invalid hash (more than 40 characters), but it should be parsed correctly,
			because we want to be compatible with sha256 hashes in the future, it only needs to be
			at least 7 characters long.
		*/
		const commit2 = createCommit(
			'def4567890123456789012345678901234567890abc',
			'Jane Doe',
			'jane@example.com',
			'2024-01-02T10:00:00Z',
			'fix: pkg2 fix',
			undefined,
			['packages/pkg2/file.ts'],
		);
		const stream = createMockStream([commit1, '\n', commit2]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(2);
		const c1 = commits[0] as { hash?: string; packages?: string[] };
		const c2 = commits[1] as { hash?: string; packages?: string[] };
		expect(c1.hash).toBe('abc123def4567890123456789012345678901234');
		expect(c1.packages).toEqual(['package1']);
		expect(c2.hash).toBe('def4567890123456789012345678901234567890abc');
		expect(c2.packages).toEqual(['package2']);
	});

	it('should handle commits with files from multiple packages', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: multi package',
			undefined,
			['packages/pkg1/file.ts', 'packages/pkg2/file.ts', 'packages/pkg3/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toEqual(['package1', 'package2', 'package3']);
	});

	it('should handle commits with no files', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'chore: update deps',
			undefined,
			[],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toBeUndefined();
	});

	it('should handle files that do not belong to any package', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'chore: root change',
			undefined,
			['README.md', 'package.json'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toBeUndefined();
	});

	it('should handle chunked data with incomplete lines', async() => {
		// Split the output across multiple chunks to test buffering
		const chunks = [
			'abc123def4567890123456789012345678901234|John|john@example.com|2024-01-01|feat: chunked|\npackages/pkg1/file',
			'.ts\npackages/pkg2/file.ts\n',
		];
		const stream = createMockStream(chunks);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toEqual(['package1', 'package2']);
	});

	it('should handle chunked data splitting a commit header across chunks', async() => {
		const chunks = [
			'abc123def4567890123456789012345678901234|John|john@example.com|2024-01-01|feat: header spl',
			'it|\npackages/pkg1/file.ts\n',
		];
		const stream = createMockStream(chunks);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { type?: string; packages?: string[] };
		expect(commit.type).toBe('feat');
		expect(commit.packages).toEqual(['package1']);
	});

	it('should map packages when package paths use Windows separators', async() => {
		const windowsRoot = 'E:\\\\Share\\\\dev\\\\monup';
		const windowsPackages = [
			{ name: '@monup/cli', path: 'E:\\\\Share\\\\dev\\\\monup\\\\packages\\\\cli', root: windowsRoot },
		];
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: windows paths',
			undefined,
			['packages/cli/src/index.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, windowsPackages, windowsRoot)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toEqual(['@monup/cli']);
	});

	it('should parse conventional commit types correctly', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'fix(api): resolve bug',
			undefined,
			['packages/pkg1/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { type?: string; scope?: string; subject?: string };
		expect(commit.type).toBe('fix');
		expect(commit.scope).toBe('api');
		expect(commit.subject).toBe('resolve bug');
	});

	it('should detect breaking changes', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat!: breaking change',
			undefined,
			['packages/pkg1/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { breaking?: boolean };
		expect(commit.breaking).toBe(true);
	});

	it('should handle commits with body text', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: feature',
			'body line 1|body line 2',
			['packages/pkg1/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { body?: string };
		expect(commit.body).toBe('body line 1|body line 2');
	});

	it('should handle empty stream', async() => {
		const stream = createMockStream(['']);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(0);
	});

	it('should handle files with relative paths starting with ./', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: relative paths',
			undefined,
			['./packages/pkg1/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		// File path "packages/pkg1/file.ts" should match package "/root/packages/pkg1"
		// After normalization: packageRelativePath = "packages/pkg1"
		// normalizedPath = "packages/pkg1/file.ts"
		// Match: "packages/pkg1/file.ts".startsWith("packages/pkg1/")
		expect(commit.packages).toEqual(['package1']);
	});

	it('should sort packages alphabetically', async() => {
		const gitOutput = createCommit(
			'abc123def4567890123456789012345678901234',
			'John Doe',
			'john@example.com',
			'2024-01-01T10:00:00Z',
			'feat: multi package',
			undefined,
			['packages/pkg3/file.ts', 'packages/pkg1/file.ts', 'packages/pkg2/file.ts'],
		);
		const stream = createMockStream([gitOutput]);
		const commits: unknown[] = [];

		for await (const commit of streamGitCommits({ stdout: stream }, mockPackages, root)) {
			commits.push(commit);
		}

		expect(commits.length).toBe(1);
		const commit = commits[0] as { packages?: string[] };
		expect(commit.packages).toEqual(['package1', 'package2', 'package3']);
	});
});
