/**
 * Changelog package options
 */

export interface ConventionalCommitType {
	title?: string;
	emoji?: string;
}

export interface ChangelogOptions {
	location?: string;
	strategy?: 'per-package' | 'root';
	issueLinks?: boolean;
	types?: Record<string, ConventionalCommitType>;
	scopeMap?: Record<string, string>;
	titles?: Record<string, string>;
	contributors?: boolean;
	capitalize?: boolean;
	group?: boolean;
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
};
