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
	/**
	 * Whether to append a markdown link for the commit hash to each changelog bullet.
	 * Only applied when commit URL template is set or resolved.
	 * @default false
	 */
	commitLinks?: boolean;
	/**
	 * URL template for commit links. Placeholders: {{hash}}, and for GitHub default {{owner}}/{{repo}}.
	 * @default 'https://github.com/{{owner}}/{{repo}}/commit/{{hash}}'
	 */
	commitUrlTemplate?: string;
	/**
	 * When true, use the full first line (e.g. feat(api): add foo) instead of only the subject.
	 * @default false
	 */
	keepTypePrefix?: boolean;
	/**
	 * Resolved commit URL template (only {{hash}} left). Set by generateChangelog; do not set in config.
	 * @internal
	 */
	resolvedCommitUrlTemplate?: string;
	/**
	 * Order of commit-type sections under a version. Types in this list are emitted in this order;
	 * types not in the list are emitted after, in map iteration order.
	 * @default ['feat', 'fix', 'perf']
	 */
	typeOrder?: string[];
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
	commitLinks: false,
	commitUrlTemplate: 'https://github.com/{{owner}}/{{repo}}/commit/{{hash}}',
	keepTypePrefix: false,
	resolvedCommitUrlTemplate: '',
	typeOrder: ['feat', 'fix', 'perf'],
};
