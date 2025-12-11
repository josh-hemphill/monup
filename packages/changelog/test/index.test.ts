import type { ParsedCommit } from '@monup/git';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractChangelogForVersion, generateChangelog } from '../src/index.ts';
import { defaultChangelogOptions } from '../src/options.ts';

describe('changelog package - core functionality', () => {
	let testDir: string;

	beforeEach(async() => {
		testDir = join(tmpdir(), `monup-changelog-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async() => {
		try {
			await rm(testDir, { recursive: true, force: true });
		}
		catch {
			// Ignore cleanup errors
		}
	});

	describe('generateChangelog', () => {
		it('should generate changelog with version markers', async() => {
			const commits: ParsedCommit[] = [
				{
					hash: 'abc123',
					message: 'feat: add new feature',
					author: 'test',
					date: '2024-01-01',
					type: 'feat',
					subject: 'add new feature',
				},
				{
					hash: 'def456',
					message: 'fix: resolve bug',
					author: 'test',
					date: '2024-01-02',
					type: 'fix',
					subject: 'resolve bug',
				},
			];

			const options = {
				...defaultChangelogOptions,
				types: {
					feat: { title: 'Features' },
					fix: { title: 'Bug Fixes' },
				},
			};

			const changelogPath = join(testDir, 'CHANGELOG.md');
			const content = await generateChangelog('1.2.3', commits, 'test-package', options, changelogPath);

			expect(content).toContain('<!-- monup:version:1.2.3:test-package:start -->');
			expect(content).toContain('<!-- monup:version:1.2.3:test-package:end -->');
			expect(content).toContain('## [1.2.3]');
			expect(content).toContain('Add new feature');
			expect(content).toContain('Resolve bug');

			// Verify file was written
			const fileContent = await readFile(changelogPath, 'utf-8');
			expect(fileContent).toContain('# Changelog');
			expect(fileContent).toContain(content);
		});

		it('should prepend to existing changelog', async() => {
			const existingChangelog = `# Changelog

## [1.0.0] - 2024-01-01

### Features
- Initial release
`;
			const changelogPath = join(testDir, 'CHANGELOG.md');
			await writeFile(changelogPath, existingChangelog, 'utf-8');

			const commits: ParsedCommit[] = [
				{
					hash: 'abc123',
					message: 'feat: new feature',
					author: 'test',
					date: '2024-01-02',
					type: 'feat',
					subject: 'new feature',
				},
			];

			const options = {
				...defaultChangelogOptions,
				types: {
					feat: { title: 'Features' },
				},
			};

			await generateChangelog('1.1.0', commits, 'test-package', options, changelogPath);

			const fileContent = await readFile(changelogPath, 'utf-8');
			expect(fileContent).toContain('## [1.1.0]');
			expect(fileContent).toContain('## [1.0.0]');
			// New version should come before old version
			const newIndex = fileContent.indexOf('## [1.1.0]');
			const oldIndex = fileContent.indexOf('## [1.0.0]');
			expect(newIndex).toBeLessThan(oldIndex);
		});

		it('should handle breaking changes', async() => {
			const commits: ParsedCommit[] = [
				{
					hash: 'abc123',
					message: 'feat!: breaking change',
					author: 'test',
					date: '2024-01-01',
					type: 'feat',
					subject: 'breaking change',
					breaking: true,
				},
			];

			const options = {
				...defaultChangelogOptions,
				types: {
					feat: { title: 'Features' },
				},
				titles: {
					breakingChanges: '🚨 Breaking Changes',
				},
			};

			const changelogPath = join(testDir, 'CHANGELOG.md');
			const content = await generateChangelog('2.0.0', commits, 'test-package', options, changelogPath);

			expect(content).toContain('🚨 Breaking Changes');
			expect(content).toContain('Breaking change');
		});

		it('should use custom location option', async() => {
			const commits: ParsedCommit[] = [
				{
					hash: 'abc123',
					message: 'feat: feature',
					author: 'test',
					date: '2024-01-01',
					type: 'feat',
					subject: 'feature',
				},
			];

			const options = {
				...defaultChangelogOptions,
				location: 'HISTORY.md',
				types: {
					feat: { title: 'Features' },
				},
			};

			const customPath = join(testDir, 'HISTORY.md');
			await generateChangelog('1.0.0', commits, 'test-package', options, customPath);

			const fileContent = await readFile(customPath, 'utf-8');
			expect(fileContent).toContain('# Changelog');
		});

		it('should create directory if it does not exist', async() => {
			const commits: ParsedCommit[] = [
				{
					hash: 'abc123',
					message: 'feat: feature',
					author: 'test',
					date: '2024-01-01',
					type: 'feat',
					subject: 'feature',
				},
			];

			const options = {
				...defaultChangelogOptions,
				types: {
					feat: { title: 'Features' },
				},
			};

			const nestedPath = join(testDir, 'docs', 'CHANGELOG.md');
			await generateChangelog('1.0.0', commits, 'test-package', options, nestedPath);

			const fileContent = await readFile(nestedPath, 'utf-8');
			expect(fileContent).toContain('# Changelog');
		});
	});

	describe('extractChangelogForVersion', () => {
		it('should extract changelog for specific version', async() => {
			const changelogContent = `# Changelog

<!-- monup:version:1.2.3:test-package:start -->
## [1.2.3] - 2024-01-01

### Features
- New feature
<!-- monup:version:1.2.3:test-package:end -->

<!-- monup:version:1.0.0:test-package:start -->
## [1.0.0] - 2024-01-01

### Features
- Initial release
<!-- monup:version:1.0.0:test-package:end -->
`;
			const changelogPath = join(testDir, 'CHANGELOG.md');
			await writeFile(changelogPath, changelogContent, 'utf-8');

			const options = {
				...defaultChangelogOptions,
			};

			const extracted = await extractChangelogForVersion('1.2.3', 'test-package', options, changelogPath);

			expect(extracted).toBeDefined();
			expect(extracted).toContain('## [1.2.3]');
			expect(extracted).toContain('New feature');
			expect(extracted).not.toContain('1.0.0');
		});

		it('should return undefined for non-existent version', async() => {
			const changelogContent = `# Changelog

<!-- monup:version:1.0.0:test-package:start -->
## [1.0.0] - 2024-01-01
<!-- monup:version:1.0.0:test-package:end -->
`;
			const changelogPath = join(testDir, 'CHANGELOG.md');
			await writeFile(changelogPath, changelogContent, 'utf-8');

			const options = {
				...defaultChangelogOptions,
			};

			const extracted = await extractChangelogForVersion('2.0.0', 'test-package', options, changelogPath);

			expect(extracted).toBeUndefined();
		});

		it('should return undefined for non-existent file', async() => {
			const options = {
				...defaultChangelogOptions,
			};

			const extracted = await extractChangelogForVersion('1.0.0', 'test-package', options, join(testDir, 'non-existent.md'));

			expect(extracted).toBeUndefined();
		});

		it('should extract changelog without package name', async() => {
			const changelogContent = `# Changelog

<!-- monup:version:1.2.3:any-package:start -->
## [1.2.3] - 2024-01-01

### Features
- New feature
<!-- monup:version:1.2.3:any-package:end -->
`;
			const changelogPath = join(testDir, 'CHANGELOG.md');
			await writeFile(changelogPath, changelogContent, 'utf-8');

			const options = {
				...defaultChangelogOptions,
			};

			const extracted = await extractChangelogForVersion('1.2.3', 'test-package', options, changelogPath);

			// Should not match because package name doesn't match
			expect(extracted).toBeUndefined();
		});
	});
});
