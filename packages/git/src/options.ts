/**
 * Git package options
 */

/**
 * Options for git operations
 */
export interface GitOptions {
	/**
	 * Whether to create commits for version changes
	 * @default true
	 */
	commit?: boolean;
	/**
	 * Whether to push commits to remote
	 * @default true
	 */
	push?: boolean;
	/**
	 * Whether to create git tags
	 * @default true
	 */
	tag?: boolean;
	/**
	 * Whether to sign commits and tags
	 * @default false
	 */
	sign?: boolean;
	/**
	 * Whether to skip git hooks (--no-verify)
	 * @default false
	 */
	noVerify?: boolean;
	/**
	 * Strategy for tag naming
	 * - 'package': Include package name in tag (e.g., 'pkg1@v1.0.0')
	 * - 'global': Use global tag format (e.g., 'v1.0.0')
	 * @default 'global'
	 */
	tagStrategy?: 'package' | 'global';
	/**
	 * Template for tag names, use %s for version placeholder
	 * @default 'v%s'
	 */
	tagTemplate?: string;
	/**
	 * Filter function to determine which tags to process
	 * If not provided, all tags are processed
	 */
	tagFilter?: (tag: string) => boolean;
	/**
	 * Starting point for commit range (tag, commit, or branch)
	 * If not provided, uses last tag or beginning of repo
	 */
	from?: string;
	/**
	 * Ending point for commit range (tag, commit, or branch)
	 * If not provided, uses HEAD
	 */
	to?: string;
}

type NonDefaultedGitOptionsKeys = 'tagFilter' | 'from' | 'to';
type DefaultedGitOptions = Omit<GitOptions, NonDefaultedGitOptionsKeys>;
type NonDefaultedGitOptions = Pick<GitOptions, NonDefaultedGitOptionsKeys>;
export type ResolvedGitOptions = Required<DefaultedGitOptions> & NonDefaultedGitOptions;

export const defaultGitOptions: ResolvedGitOptions = {
	commit: true,
	push: true,
	tag: true,
	sign: false,
	noVerify: false,
	tagStrategy: 'global',
	tagTemplate: 'v%s',
	tagFilter: () => true,
	from: undefined,
	to: undefined,
};
