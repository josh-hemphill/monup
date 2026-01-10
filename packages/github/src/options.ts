/**
 * GitHub package options
 */
import type { ChangelogOptions } from '@monup/changelog';

/**
 * Options for GitHub release creation
 */
export interface GitHubOptions {
	/**
	 * GitHub base URL (for GitHub Enterprise)
	 * @default 'github.com'
	 */
	baseUrl?: string;
	/**
	 * GitHub API base URL (for GitHub Enterprise)
	 * @default 'api.github.com'
	 */
	baseUrlApi?: string;
	/**
	 * Repository in format 'owner/repo'
	 * If not provided, will be detected from git remote
	 */
	repo?: string;
	/**
	 * Repository to create releases in (if different from repo)
	 * If not provided, uses repo
	 */
	releaseRepo?: string;
	/**
	 * Whether to create a prerelease
	 * If not provided, will be auto-detected from version
	 */
	prerelease?: boolean;
	/**
	 * Method to extract changelog content
	 * - 'markers': Extract content between version markers
	 * - 'regenerate': Regenerate changelog from commits
	 * - 'auto': Automatically choose the best method
	 * @default 'auto'
	 */
	changelogMethod?: 'markers' | 'regenerate' | 'auto';
}

/**
 * GitHub options with changelog dependency
 * For standalone usage, only partial changelog options are needed
 */
export interface GitHubOptionsWithDeps extends GitHubOptions {
	/**
	 * Partial changelog options needed for GitHub release creation
	 */
	changelog?: Partial<Pick<ChangelogOptions, 'location' | 'strategy'>>;
}

type NonDefaultedGitHubOptionsKeys = 'repo' | 'releaseRepo' | 'prerelease';
type DefaultedGitHubOptions = Omit<GitHubOptions, NonDefaultedGitHubOptionsKeys>;
type NonDefaultedGitHubOptions = Pick<GitHubOptions, NonDefaultedGitHubOptionsKeys>;
export type ResolvedGitHubOptions = Required<DefaultedGitHubOptions> & NonDefaultedGitHubOptions;

export const defaultGitHubOptions: ResolvedGitHubOptions = {
	baseUrl: 'github.com',
	baseUrlApi: 'api.github.com',
	repo: undefined,
	releaseRepo: undefined,
	prerelease: undefined,
	changelogMethod: 'auto',
};
