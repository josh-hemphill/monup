/**
 * Unit tests for github package release
 */

import type { GitHubOptionsWithDeps } from '../src/options.ts';
import { describe, expect, it } from 'vitest';
import { createRelease } from '../src/release.ts';

describe('release', () => {
	it('should throw error when creating release without token', async() => {
		const options: GitHubOptionsWithDeps = {
			repo: 'test-owner/test-repo',
			changelogMethod: 'markers', // Use markers to avoid git operations
		};
		const gitOptions = {};

		// Temporarily remove token if it exists
		const originalToken = process.env.GITHUB_TOKEN;
		delete process.env.GITHUB_TOKEN;

		try {
			await expect(createRelease('1.0.0', 'test-package', 'v1.0.0', options, gitOptions)).rejects.toThrow('GITHUB_TOKEN');
		}
		finally {
			if (typeof originalToken === 'string') {
				process.env.GITHUB_TOKEN = originalToken;
			}
		}
	});

	it('should throw error when creating release without repo', async() => {
		const options: GitHubOptionsWithDeps = {
			changelogMethod: 'markers', // Use markers to avoid git operations
		};
		const gitOptions = {};

		// Set a dummy token to get past token check
		const originalToken = process.env.GITHUB_TOKEN;
		process.env.GITHUB_TOKEN = 'dummy-token';

		try {
			await expect(createRelease('1.0.0', 'test-package', 'v1.0.0', options, gitOptions)).rejects.toThrow('repository not configured');
		}
		finally {
			if (typeof originalToken === 'string') {
				process.env.GITHUB_TOKEN = originalToken;
			}
			else {
				delete process.env.GITHUB_TOKEN;
			}
		}
	});
});
