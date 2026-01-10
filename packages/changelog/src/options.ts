/**
 * Changelog package options
 */

/**
 * Configuration for a conventional commit type
 */
export interface ConventionalCommitType {
	/**
	 * Title to display in changelog for this commit type
	 */
	title?: string;
	/**
	 * Emoji to display with the title
	 */
	emoji?: string;
}

/**
 * Options for changelog generation
 */
export interface ChangelogOptions {
	/**
	 * Path to the changelog file
	 * @default 'CHANGELOG.md'
	 */
	location?: string;
	/**
	 * Strategy for changelog generation
	 * - 'per-package': Generate separate changelog for each package
	 * - 'root': Generate single changelog at workspace root
	 * @default 'per-package'
	 */
	strategy?: 'per-package' | 'root';
	/**
	 * Whether to convert issue references to links
	 * @default false
	 */
	issueLinks?: boolean;
	/**
	 * Mapping of commit types to their display configuration
	 * @default { feat: { title: '🚀 Features', emoji: '🚀' }, fix: { title: '🐞 Bug Fixes', emoji: '🐞' }, perf: { title: '🏎 Performance', emoji: '🏎' } }
	 */
	types?: Record<string, ConventionalCommitType>;
	/**
	 * Mapping of scope names to their display names
	 * @default {}
	 */
	scopeMap?: Record<string, string>;
	/**
	 * Custom titles for changelog sections
	 * @default { breakingChanges: '🚨 Breaking Changes' }
	 */
	titles?: Record<string, string>;
	/**
	 * Whether to include contributors section
	 * @default true
	 */
	contributors?: boolean;
	/**
	 * Whether to capitalize the first letter of commit messages
	 * @default true
	 */
	capitalize?: boolean;
	/**
	 * Whether to group commits by scope
	 * @default true
	 */
	group?: boolean;
	/**
	 * Default version to use when version cannot be determined
	 * Used when generating changelog for the first time or when version detection fails
	 * @default '1.0.0'
	 */
	defaultVersion?: string;
}

export const defaultChangelogOptions: Required<ChangelogOptions> = {
	location: 'CHANGELOG.md',
	strategy: 'per-package',
	issueLinks: false,
	types: {
		feat: { title: '🚀 Features', emoji: '🚀' },
		fix: { title: '🐞 Bug Fixes', emoji: '🐞' },
		perf: { title: '🏎 Performance', emoji: '🏎' },
	},
	scopeMap: {},
	titles: {
		breakingChanges: '🚨 Breaking Changes',
	},
	contributors: true,
	capitalize: true,
	group: true,
	defaultVersion: '1.0.0',
};
