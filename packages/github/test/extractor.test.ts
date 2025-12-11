/**
 * Unit tests for github package extractor
 */

import type { GitHubOptionsWithDeps } from '../src/options.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractChangelogForRelease } from '../src/extractor.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');
const changelogPath = join(fixturesDir, 'CHANGELOG.md');

describe('extractor', () => {
	it('should extract changelog for release using markers', async() => {
		const options: GitHubOptionsWithDeps = {
			repo: 'test-owner/test-repo',
			changelog: {
				location: 'CHANGELOG.md',
			},
			changelogMethod: 'markers',
		};

		const changelog = await extractChangelogForRelease('1.0.0', 'test-package', options, changelogPath);
		expect(typeof changelog).toBe('string');
		expect(changelog?.length).toBeGreaterThan(0);
		expect(changelog).toContain('1.0.0');
		expect(changelog).toContain('Initial release');
	});

	it('should return undefined when changelog markers not found', async() => {
		const options: GitHubOptionsWithDeps = {
			repo: 'test-owner/test-repo',
			changelog: {
				location: 'CHANGELOG.md',
			},
			changelogMethod: 'markers',
		};

		const changelog = await extractChangelogForRelease('2.0.0', 'test-package', options, changelogPath);
		expect(changelog).toBeUndefined();
	});
});
