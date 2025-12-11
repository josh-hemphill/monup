/**
 * GitHub package options
 */
import type { ChangelogOptions } from '@monup/changelog';

export interface GitHubOptions {
	baseUrl?: string;
	baseUrlApi?: string;
	repo?: string;
	releaseRepo?: string;
	prerelease?: boolean;
	changelogMethod?: 'markers' | 'regenerate' | 'auto';
}

/**
 * GitHub options with changelog dependency
 * For standalone usage, only partial changelog options are needed
 */
export interface GitHubOptionsWithDeps extends GitHubOptions {
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
