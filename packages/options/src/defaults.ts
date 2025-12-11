/**
 * Default configuration values for monup
 * Aggregates defaults from all packages
 */
import type { ResolvedMonupOptions } from './types.ts';
import { defaultChangelogOptions } from '@monup/changelog';
import { defaultGitOptions } from '@monup/git';
import { defaultGitHubOptions } from '@monup/github';
import { defaultReleaseOptions } from '@monup/release';
import { defaultVersionOptions } from '@monup/version';

export const defaultCoreOptions = {
	ci: {
		autoDetect: true,
	},
	conventional: {
		scopes: {},
		types: {},
		titles: {},
	},
	confirm: true,
	logLevel: {
		default: 'warn' as const,
		packages: {},
	},
};

export const defaultOptions: ResolvedMonupOptions = {
	...defaultCoreOptions,
	changelog: defaultChangelogOptions,
	version: defaultVersionOptions,
	git: defaultGitOptions,
	github: defaultGitHubOptions,
	release: defaultReleaseOptions,
	isCI: false,
};
