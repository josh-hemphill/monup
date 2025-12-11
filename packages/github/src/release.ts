import type { GitHubOptionsWithDeps } from './options.ts';
/**
 * GitHub release creation
 */
import { env } from 'node:process';
import { extractChangelogForRelease } from './extractor.ts';

/**
 * Creates a GitHub release
 * Accepts GitHubOptionsWithDeps (includes partial changelog options)
 */
export async function createRelease(
	version: string,
	packageName: string,
	tagName: string,
	options: GitHubOptionsWithDeps,
	changelogPath?: string,
): Promise<void> {
	const githubOpts: GitHubOptionsWithDeps = options;

	// Extract changelog
	const changelog = await extractChangelogForRelease(
		version,
		packageName,
		githubOpts,
		changelogPath,
	);

	// Build release payload
	const releaseData = {
		tag_name: tagName,
		name: tagName,
		body: typeof changelog === 'string' ? changelog : `Release ${version}`,
		prerelease: githubOpts.prerelease ?? false,
		draft: false,
	};

	// Create release via GitHub API
	const baseUrl = typeof githubOpts.baseUrlApi === 'string' ? githubOpts.baseUrlApi : 'api.github.com';
	const repo = typeof githubOpts.releaseRepo === 'string' ? githubOpts.releaseRepo : githubOpts.repo;

	if (typeof repo !== 'string') {
		throw new TypeError('GitHub repository not configured');
	}

	const url = `https://${baseUrl}/repos/${repo}/releases`;
	const token = env.GITHUB_TOKEN;

	if (typeof token !== 'string') {
		throw new TypeError('GITHUB_TOKEN environment variable not set');
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `token ${token}`,
			'Content-Type': 'application/json',
			'Accept': 'application/vnd.github.v3+json',
		},
		body: JSON.stringify(releaseData),
	});

	if (response.ok !== true) {
		const error = await response.text();
		throw new Error(`Failed to create GitHub release: ${error}`);
	}
}
