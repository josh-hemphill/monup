import type { GitOptions } from '@monup/git';
import type { GitHubOptionsWithDeps } from './options.ts';
/**
 * GitHub release creation and listing
 */
import { env } from 'node:process';
import { extractVersionFromTag } from '@monup/git';
import { sortVersionsDescending } from '@monup/utils';
import { extractChangelogForRelease } from './extractor.ts';
import { logger } from './logger.ts';

/**
 * Creates a GitHub release
 * Accepts GitHubOptionsWithDeps (includes partial changelog options)
 */
export async function createRelease(
	version: string,
	packageName: string,
	tagName: string,
	options: GitHubOptionsWithDeps,
	gitOptions: GitOptions,
	changelogPath?: string,
): Promise<void> {
	const githubOpts: GitHubOptionsWithDeps = options;

	// Extract changelog
	const changelog = await extractChangelogForRelease(
		version,
		packageName,
		githubOpts,
		gitOptions,
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

/**
 * GitHub release information
 */
export interface GitHubRelease {
	tag_name: string;
	name: string;
	version: string;
	created_at: string;
	published_at: string | null;
	prerelease: boolean;
	draft: boolean;
}

/**
 * Lists existing GitHub releases for a repository
 * @param options - GitHub options
 * @returns Array of release objects, sorted by version (descending)
 */
export async function listReleases(
	options: GitHubOptionsWithDeps,
): Promise<GitHubRelease[]> {
	const githubOpts: GitHubOptionsWithDeps = options;
	const baseUrl = typeof githubOpts.baseUrlApi === 'string' ? githubOpts.baseUrlApi : 'api.github.com';
	const repo = typeof githubOpts.releaseRepo === 'string' ? githubOpts.releaseRepo : githubOpts.repo;

	if (typeof repo !== 'string') {
		logger.debug('GitHub repository not configured');
		return [];
	}

	const token = env.GITHUB_TOKEN;
	if (typeof token !== 'string') {
		logger.debug('GITHUB_TOKEN environment variable not set');
		return [];
	}

	const url = `https://${baseUrl}/repos/${repo}/releases`;
	logger.debug('Listing GitHub releases', { repo, url });

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github.v3+json',
			},
		});

		if (response.ok !== true) {
			logger.debug('Failed to list GitHub releases', {
				status: response.status,
				statusText: response.statusText,
			});
			return [];
		}

		const releases = await response.json() as Array<{
			tag_name: string;
			name: string;
			created_at: string;
			published_at: string | null;
			prerelease: boolean;
			draft: boolean;
			[key: string]: unknown;
		}>;

		// Extract version from tag_name (remove 'v' prefix if present)
		const processedReleases: GitHubRelease[] = releases
			.filter((r) => r.draft === false) // Exclude draft releases
			.map((r) => {
				const version = extractVersionFromTag(r.tag_name);
				return {
					tag_name: r.tag_name,
					name: r.name,
					version,
					created_at: r.created_at,
					published_at: r.published_at,
					prerelease: r.prerelease,
					draft: r.draft,
				};
			});

		const sortedVersions = sortVersionsDescending(processedReleases.map((r) => r.version));
		const sorted = processedReleases.sort((a, b) => {
			return sortedVersions.indexOf(a.version) - sortedVersions.indexOf(b.version);
		});

		logger.debug('GitHub releases retrieved', { count: sorted.length });
		return sorted;
	}
	catch (error: unknown) {
		logger.debug('Failed to list GitHub releases', {
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}
