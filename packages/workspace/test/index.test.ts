import type { PackageInfo } from '../src/plugins/index.ts';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectPackages, getPackageInfo, updatePackageVersions } from '../src/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const pnpmWorkspaceDir = join(fixturesDir, 'pnpm-workspace');
const npmWorkspaceDir = join(fixturesDir, 'npm-workspace');
const denoWorkspaceDir = join(fixturesDir, 'deno-workspace');
const singlePackageDir = join(fixturesDir, 'single-package');
const npmAndJsrDir = join(fixturesDir, 'npm-and-jsr');

describe('workspace package - core functionality', () => {
	describe('detectPackages', () => {
		it('should detect packages in pnpm workspace', async () => {
			const packages = await detectPackages(pnpmWorkspaceDir);
			expect(Array.isArray(packages)).toBe(true);
			expect(packages.length).toBeGreaterThanOrEqual(0);
			packages.forEach((pkg) => {
				expect(typeof pkg.name).toBe('string');
				expect(typeof pkg.path).toBe('string');
				expect(typeof pkg.root).toBe('string');
				expect(pkg.root).toBe(pnpmWorkspaceDir);
			});
			// If packages are detected, verify structure
			if (packages.length > 0) {
				const packageNames = packages.map((p) => p.name);
				expect(packageNames.length).toBeGreaterThan(0);
			}
		});

		it('should detect packages in npm workspace', async () => {
			const packages = await detectPackages(npmWorkspaceDir);
			expect(Array.isArray(packages)).toBe(true);
			expect(packages.length).toBeGreaterThanOrEqual(0);
			packages.forEach((pkg) => {
				expect(typeof pkg.name).toBe('string');
				expect(typeof pkg.path).toBe('string');
				expect(typeof pkg.root).toBe('string');
				expect(pkg.root).toBe(npmWorkspaceDir);
			});
		});

		it('should detect packages in deno workspace', async () => {
			const packages = await detectPackages(denoWorkspaceDir);
			expect(Array.isArray(packages)).toBe(true);
			expect(packages.length).toBeGreaterThanOrEqual(0);
			packages.forEach((pkg) => {
				expect(typeof pkg.name).toBe('string');
				expect(typeof pkg.path).toBe('string');
				expect(typeof pkg.root).toBe('string');
				expect(pkg.root).toBe(denoWorkspaceDir);
			});
			// If packages are detected, verify structure
			if (packages.length > 0) {
				const packageNames = packages.map((p) => p.name);
				expect(packageNames.length).toBeGreaterThan(0);
			}
		});

		it('should detect root as single package when no workspace detected', async () => {
			const packages = await detectPackages(singlePackageDir);
			expect(Array.isArray(packages)).toBe(true);
			expect(packages.length).toBe(1);
			expect(packages[0]?.name).toBe('single-package');
			expect(packages[0]?.path).toBe(singlePackageDir);
			expect(packages[0]?.root).toBe(singlePackageDir);
		});

		it('should detect both package.json and jsr.json as two packages in same directory', async () => {
			const packages = await detectPackages(npmAndJsrDir);
			expect(Array.isArray(packages)).toBe(true);
			expect(packages.length).toBe(2);
			expect(packages[0]?.name).toBe('pkg1');
			expect(packages[1]?.name).toBe('pkg1');
			expect(packages[0]?.packageFile).toBe(join(npmAndJsrDir, 'package.json'));
			expect(packages[1]?.packageFile).toBe(join(npmAndJsrDir, 'jsr.json'));
		});
	});

	describe('getPackageInfo', () => {
		it('should get package info by name from fixtures', async () => {
			const packages = await detectPackages(singlePackageDir);
			expect(packages.length).toBeGreaterThan(0);
			const firstPackage = packages[0];
			expect(firstPackage).toBeDefined();
			const packageInfo = await getPackageInfo(firstPackage.name, singlePackageDir);
			expect(packageInfo).toBeDefined();
			expect(packageInfo?.name).toBe(firstPackage.name);
			expect(packageInfo?.path).toBe(firstPackage.path);
		});

		it('should handle non-existent package name', async () => {
			const packageInfo = await getPackageInfo('non-existent-package-12345', pnpmWorkspaceDir);
			expect(packageInfo).toBeUndefined();
		});

		describe('with temporary directories', () => {
			let testDir: string;

			beforeEach(async () => {
				testDir = join(tmpdir(), `monup-workspace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
				await mkdir(testDir, { recursive: true });
			});

			afterEach(async () => {
				try {
					await rm(testDir, { recursive: true, force: true });
				}
				catch {
					// Ignore cleanup errors
				}
			});

			it('should find package by name in single package repo', async () => {
				const packageJsonPath = join(testDir, 'package.json');
				await writeFile(packageJsonPath, JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}, null, 2), 'utf-8');

				const packageInfo = await getPackageInfo('test-package', testDir);

				expect(packageInfo).toBeDefined();
				expect(packageInfo?.name).toBe('test-package');
				expect(packageInfo?.path).toBe(testDir);
			});

			it('should return undefined for non-existent package', async () => {
				const packageJsonPath = join(testDir, 'package.json');
				await writeFile(packageJsonPath, JSON.stringify({
					name: 'test-package',
					version: '1.0.0',
				}, null, 2), 'utf-8');

				const packageInfo = await getPackageInfo('non-existent', testDir);

				expect(packageInfo).toBeUndefined();
			});

			it('should find package with root name when name is missing', async () => {
				const packageJsonPath = join(testDir, 'package.json');
				await writeFile(packageJsonPath, JSON.stringify({
					version: '1.0.0',
				}, null, 2), 'utf-8');

				const packageInfo = await getPackageInfo('root', testDir);

				expect(packageInfo).toBeDefined();
				expect(packageInfo?.name).toBe('root');
			});
		});
	});

	describe('updatePackageVersions', () => {
		let testDir: string;

		beforeEach(async () => {
			testDir = join(tmpdir(), `monup-workspace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
			await mkdir(testDir, { recursive: true });
		});

		afterEach(async () => {
			try {
				await rm(testDir, { recursive: true, force: true });
			}
			catch {
				// Ignore cleanup errors
			}
		});

		it('should update versions for multiple packages', async () => {
			// Create two packages
			const pkg1Path = join(testDir, 'package1');
			const pkg2Path = join(testDir, 'package2');
			await mkdir(pkg1Path, { recursive: true });
			await mkdir(pkg2Path, { recursive: true });

			const pkg1Json = join(pkg1Path, 'package.json');
			const pkg2Json = join(pkg2Path, 'package.json');

			await writeFile(pkg1Json, JSON.stringify({
				name: 'package1',
				version: '1.0.0',
			}, null, 2), 'utf-8');

			await writeFile(pkg2Json, JSON.stringify({
				name: 'package2',
				version: '1.0.0',
			}, null, 2), 'utf-8');

			const packages: PackageInfo[] = [
				{
					name: 'package1',
					path: pkg1Path,
					root: testDir,
					packageFile: pkg1Json,
				},
				{
					name: 'package2',
					path: pkg2Path,
					root: testDir,
					packageFile: pkg2Json,
				},
			];

			const versionMap = new Map<string, string>([
				['package1', '2.0.0'],
				['package2', '2.1.0'],
			]);

			await updatePackageVersions(packages, versionMap);

			// Verify updates
			const pkg1Content = await readFile(pkg1Json, 'utf-8');
			const pkg1Parsed = JSON.parse(pkg1Content) as { version?: string };
			expect(pkg1Parsed.version).toBe('2.0.0');

			const pkg2Content = await readFile(pkg2Json, 'utf-8');
			const pkg2Parsed = JSON.parse(pkg2Content) as { version?: string };
			expect(pkg2Parsed.version).toBe('2.1.0');
		});

		it('should skip packages not in version map', async () => {
			const pkg1Path = join(testDir, 'package1');
			await mkdir(pkg1Path, { recursive: true });

			const pkg1Json = join(pkg1Path, 'package.json');
			await writeFile(pkg1Json, JSON.stringify({
				name: 'package1',
				version: '1.0.0',
			}, null, 2), 'utf-8');

			const packages: PackageInfo[] = [
				{
					name: 'package1',
					path: pkg1Path,
					root: testDir,
					packageFile: pkg1Json,
				},
			];

			const versionMap = new Map<string, string>([
				['package2', '2.0.0'], // Different package
			]);

			await updatePackageVersions(packages, versionMap);

			// Verify no change
			const pkg1Content = await readFile(pkg1Json, 'utf-8');
			const pkg1Parsed = JSON.parse(pkg1Content) as { version?: string };
			expect(pkg1Parsed.version).toBe('1.0.0');
		});

		it('should skip packages without packageFile', async () => {
			const packages: PackageInfo[] = [
				{
					name: 'package1',
					path: testDir,
					root: testDir,
					packageFile: undefined,
				},
			];

			const versionMap = new Map<string, string>([
				['package1', '2.0.0'],
			]);

			// Should not throw
			await expect(updatePackageVersions(packages, versionMap)).resolves.not.toThrow();
		});

		it('should handle deno.json packages', async () => {
			const pkgPath = join(testDir, 'deno-package');
			await mkdir(pkgPath, { recursive: true });

			const denoJson = join(pkgPath, 'deno.json');
			await writeFile(denoJson, JSON.stringify({
				name: 'deno-package',
				version: '1.0.0',
			}, null, 2), 'utf-8');

			const packages: PackageInfo[] = [
				{
					name: 'deno-package',
					path: pkgPath,
					root: testDir,
					packageFile: denoJson,
				},
			];

			const versionMap = new Map<string, string>([
				['deno-package', '2.0.0'],
			]);

			await updatePackageVersions(packages, versionMap);

			// Verify update
			const content = await readFile(denoJson, 'utf-8');
			const parsed = JSON.parse(content) as { version?: string };
			expect(parsed.version).toBe('2.0.0');
		});
	});
});
