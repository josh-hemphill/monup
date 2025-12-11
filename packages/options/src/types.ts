/**
 * Core option types for monup configuration
 * Aggregates options from all packages
 */
import type { ChangelogOptions } from '@monup/changelog';
import type { GitOptions } from '@monup/git';
import type { GitHubOptions } from '@monup/github';
import type { ReleaseOptions, ResolvedReleaseOptions } from '@monup/release';
import type { VersionOptions } from '@monup/version';
import type { CoreMonupOptions, LogLevelConfig } from './core.ts';

/**
 * Unified options interface for monup CLI
 * Aggregates all package options + core options
 */
export interface MonupOptions extends CoreMonupOptions {
	changelog?: ChangelogOptions;
	version?: VersionOptions;
	git?: GitOptions;
	github?: GitHubOptions;
	release?: ReleaseOptions;
}

/**
 * Resolved options with all defaults applied
 * Only used by CLI and options package itself
 */
export interface ResolvedMonupOptions extends Omit<Required<CoreMonupOptions>, 'logLevel'> {
	changelog: Required<ChangelogOptions>;
	version: Required<VersionOptions>;
	git: Required<Omit<GitOptions, 'tagFilter' | 'from' | 'to'>> & Pick<GitOptions, 'tagFilter' | 'from' | 'to'>;
	github: Required<Omit<GitHubOptions, 'repo' | 'releaseRepo' | 'prerelease'>> & Pick<GitHubOptions, 'repo' | 'releaseRepo' | 'prerelease'>;
	release: ResolvedReleaseOptions;
	logLevel: Required<LogLevelConfig>;
	isCI: boolean;
}
