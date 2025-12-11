import type { ParsedCommit } from '@monup/git';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calculateVersion, getCurrentVersionFromFile, updateVersionInAdditionalFiles, updateVersionInFile } from '../src/index.ts';

describe('version package - core functionality', () => {
	let testDir: string;

	beforeEach(async() => {
		// Create a temporary directory for each test
		testDir = join(tmpdir(), `monup-version-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async() => {
		// Clean up temporary directory
		try {
			await rm(testDir, { recursive: true, force: true });
		}
		catch {
			// Ignore cleanup errors
		}
	});

	describe('getCurrentVersionFromFile', () => {
		it('should read version from package.json', async() => {
			const packageJsonPath = join(testDir, 'package.json');
			const packageJson = {
				name: 'test-package',
				version: '1.2.3',
			};
			await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

			const version = await getCurrentVersionFromFile(packageJsonPath);
			expect(version).toBe('1.2.3');
		});

		it('should read version from deno.json', async() => {
			const denoJsonPath = join(testDir, 'deno.json');
			const denoJson = {
				name: 'test-package',
				version: '2.0.0',
			};
			await writeFile(denoJsonPath, JSON.stringify(denoJson, null, 2), 'utf-8');

			const version = await getCurrentVersionFromFile(denoJsonPath);
			expect(version).toBe('2.0.0');
		});

		it('should read version from deno.jsonc with comments', async() => {
			const denoJsoncPath = join(testDir, 'deno.jsonc');
			const denoJsonc = `{
  // This is a comment
  "name": "test-package",
  "version": "3.0.0"
}`;
			await writeFile(denoJsoncPath, denoJsonc, 'utf-8');

			const version = await getCurrentVersionFromFile(denoJsoncPath);
			expect(version).toBe('3.0.0');
		});

		it('should read version from jsr.json', async() => {
			const jsrJsonPath = join(testDir, 'jsr.json');
			const jsrJson = {
				name: '@test/package',
				version: '1.0.0',
			};
			await writeFile(jsrJsonPath, JSON.stringify(jsrJson, null, 2), 'utf-8');

			const version = await getCurrentVersionFromFile(jsrJsonPath);
			expect(version).toBe('1.0.0');
		});

		it('should return undefined for file without version', async() => {
			const packageJsonPath = join(testDir, 'package.json');
			const packageJson = {
				name: 'test-package',
			};
			await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

			const version = await getCurrentVersionFromFile(packageJsonPath);
			expect(version).toBeUndefined();
		});

		it('should return undefined for non-existent file', async() => {
			const version = await getCurrentVersionFromFile(join(testDir, 'non-existent.json'));
			expect(version).toBeUndefined();
		});
	});

	describe('updateVersionInFile', () => {
		it('should update version in package.json', async() => {
			const packageJsonPath = join(testDir, 'package.json');
			const packageJson = {
				name: 'test-package',
				version: '1.2.3',
			};
			await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

			await updateVersionInFile(packageJsonPath, '2.0.0');

			const updated = await readFile(packageJsonPath, 'utf-8');
			const parsed = JSON.parse(updated) as { version: string; name: string };
			expect(parsed.version).toBe('2.0.0');
			expect(parsed.name).toBe('test-package'); // Other fields preserved
		});

		it('should update version in deno.json', async() => {
			const denoJsonPath = join(testDir, 'deno.json');
			const denoJson = {
				name: 'test-package',
				version: '1.0.0',
			};
			await writeFile(denoJsonPath, JSON.stringify(denoJson, null, 2), 'utf-8');

			await updateVersionInFile(denoJsonPath, '1.1.0');

			const updated = await readFile(denoJsonPath, 'utf-8');
			const parsed = JSON.parse(updated) as { version: string; name: string };
			expect(parsed.version).toBe('1.1.0');
		});

		it('should update version in deno.jsonc preserving comments', async() => {
			const denoJsoncPath = join(testDir, 'deno.jsonc');
			const denoJsonc = `{
  // Comment before version
  "name": "test-package",
  "version": "1.0.0",
  // Comment after version
  "tasks": {}
}`;
			await writeFile(denoJsoncPath, denoJsonc, 'utf-8');

			await updateVersionInFile(denoJsoncPath, '2.0.0');

			const updated = await readFile(denoJsoncPath, 'utf-8');
			expect(updated).toContain('"version": "2.0.0"');
			expect(updated).toContain('// Comment before version');
			expect(updated).toContain('// Comment after version');
		});

		it('should update version in jsr.json', async() => {
			const jsrJsonPath = join(testDir, 'jsr.json');
			const jsrJson = {
				name: '@test/package',
				version: '0.1.0',
			};
			await writeFile(jsrJsonPath, JSON.stringify(jsrJson, null, 2), 'utf-8');

			await updateVersionInFile(jsrJsonPath, '0.2.0');

			const updated = await readFile(jsrJsonPath, 'utf-8');
			const parsed = JSON.parse(updated) as { version: string; name: string };
			expect(parsed.version).toBe('0.2.0');
		});

		it('should throw error for unsupported file type', async() => {
			const unsupportedPath = join(testDir, 'unsupported.txt');
			await writeFile(unsupportedPath, 'version: 1.0.0', 'utf-8');

			await expect(updateVersionInFile(unsupportedPath, '2.0.0')).rejects.toThrow();
		});
	});

	describe('updateVersionInAdditionalFiles', () => {
		it('should update version in README.md', async() => {
			const readmePath = join(testDir, 'README.md');
			const readme = `# Test Package

Current version: 1.2.3
Install with: npm install test@1.2.3
`;
			await writeFile(readmePath, readme, 'utf-8');

			await updateVersionInAdditionalFiles([readmePath], '1.2.3', '2.0.0');

			const updated = await readFile(readmePath, 'utf-8');
			expect(updated).toContain('Current version: 2.0.0');
			expect(updated).toContain('npm install test@2.0.0');
		});

		it('should update version with v prefix', async() => {
			const readmePath = join(testDir, 'README.md');
			const readme = `# Test Package

Version v1.2.3 is available.
`;
			await writeFile(readmePath, readme, 'utf-8');

			await updateVersionInAdditionalFiles([readmePath], '1.2.3', '2.0.0');

			const updated = await readFile(readmePath, 'utf-8');
			expect(updated).toContain('Version v2.0.0 is available.');
		});

		it('should update multiple occurrences', async() => {
			const readmePath = join(testDir, 'README.md');
			const readme = `# Test Package

Version 1.2.3
See changelog for 1.2.3
Install 1.2.3 now
`;
			await writeFile(readmePath, readme, 'utf-8');

			await updateVersionInAdditionalFiles([readmePath], '1.2.3', '2.0.0');

			const updated = await readFile(readmePath, 'utf-8');
			expect(updated).not.toContain('1.2.3');
			expect(updated).toContain('2.0.0');
		});

		it('should handle multiple files', async() => {
			const readmePath = join(testDir, 'README.md');
			const changelogPath = join(testDir, 'CHANGELOG.md');
			await writeFile(readmePath, 'Version 1.0.0', 'utf-8');
			await writeFile(changelogPath, 'Version 1.0.0', 'utf-8');

			await updateVersionInAdditionalFiles([readmePath, changelogPath], '1.0.0', '1.1.0');

			const readme = await readFile(readmePath, 'utf-8');
			const changelog = await readFile(changelogPath, 'utf-8');
			expect(readme).toContain('1.1.0');
			expect(changelog).toContain('1.1.0');
		});

		it('should skip non-existent files silently', async() => {
			const nonExistentPath = join(testDir, 'non-existent.md');

			await expect(updateVersionInAdditionalFiles([nonExistentPath], '1.0.0', '2.0.0')).resolves.not.toThrow();
		});

		it('should not update file if version not found', async() => {
			const readmePath = join(testDir, 'README.md');
			const original = 'No version here';
			await writeFile(readmePath, original, 'utf-8');

			await updateVersionInAdditionalFiles([readmePath], '1.0.0', '2.0.0');

			const updated = await readFile(readmePath, 'utf-8');
			expect(updated).toBe(original);
		});
	});

	describe('calculateVersion', () => {
		it('should calculate patch bump from fix commits', () => {
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
			const result = calculateVersion('1.2.3', commits);
			expect(result.bumpType).toBe('patch');
			expect(result.nextVersion).toBe('1.2.4');
		});

		it('should calculate minor bump from feat commits', () => {
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
			const result = calculateVersion('1.2.3', commits);
			expect(result.bumpType).toBe('minor');
			expect(result.nextVersion).toBe('1.3.0');
		});

		it('should calculate major bump from breaking changes', () => {
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
			const result = calculateVersion('1.2.3', commits);
			expect(result.bumpType).toBe('major');
			expect(result.nextVersion).toBe('2.0.0');
		});

		it('should return undefined for no version bump', () => {
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
			const result = calculateVersion('1.2.3', commits);
			expect(result.bumpType).toBeUndefined();
			expect(result.nextVersion).toBeUndefined();
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
			const result = calculateVersion('1.2.3', commits, customMapping);
			expect(result.bumpType).toBe('minor');
			expect(result.nextVersion).toBe('1.3.0');
		});

		it('should handle empty commits array', () => {
			const result = calculateVersion('1.2.3', []);
			expect(result.bumpType).toBeUndefined();
			expect(result.nextVersion).toBeUndefined();
		});
	});
});
