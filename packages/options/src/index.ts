import type { CoreMonupOptions } from './core.ts';
import type { MonupOptions, ResolvedMonupOptions } from './types.ts';
import { cwd } from 'node:process';
/**
 * Options resolution and normalization for monup
 */
import { defaultChangelogOptions } from '@monup/changelog';
import { defaultGitOptions } from '@monup/git';
import { defaultGitHubOptions } from '@monup/github';
import { defaultReleaseOptions } from '@monup/release';
import { detectCI, mergeWithDefaults } from '@monup/utils';
import { defaultVersionOptions } from '@monup/version';
import { loadConfig } from 'c12';
import packageJson from '../jsr.json' with { type: 'json' };
import { defaultCoreOptions } from './defaults.ts';

export const _VERSION: string = packageJson.version;

export type { ConventionalConfig, ConventionalScope, CoreMonupOptions, LogLevel, LogLevelConfig } from './core.ts';
/**
 * Resolves and normalizes monup options from multiple sources
 * Merges CLI arguments, config files, and programmatic options
 */
export async function resolveOptions(
	overrides?: Partial<MonupOptions>,
	workingDir: string = cwd(),
): Promise<ResolvedMonupOptions> {
	// Load config from files using c12
	const { config: fileConfig } = await loadConfig<MonupOptions>({
		name: 'monup',
		defaults: {},
		overrides: overrides ?? {},
		cwd: workingDir,
	});

	// Detect CI environment
	const isCI = (fileConfig?.ci?.autoDetect !== false && overrides?.ci?.autoDetect !== false) && detectCI();

	// Merge all config sources with deep merge
	const baseConfig: MonupOptions = {
		changelog: defaultChangelogOptions,
		version: defaultVersionOptions,
		git: defaultGitOptions,
		github: defaultGitHubOptions,
		release: defaultReleaseOptions,
		ci: { autoDetect: true },
		conventional: { scopes: {}, types: {}, titles: {} },
		logLevel: defaultCoreOptions.logLevel,
		confirm: true,
	};

	const mergedConfig = mergeWithDefaults(
		baseConfig as Record<string, unknown>,
		mergeWithDefaults(
			(typeof fileConfig !== 'undefined' && fileConfig !== null ? fileConfig : {}) as Record<string, unknown>,
			(typeof overrides !== 'undefined' && overrides !== null ? overrides : {}) as Record<string, unknown>,
		),
	) as MonupOptions;

	// Build resolved options with all required fields
	const resolved: ResolvedMonupOptions = {
		changelog: mergeWithDefaults(
			defaultChangelogOptions,
			(mergedConfig.changelog || {}),
		),
		version: mergeWithDefaults(
			defaultVersionOptions,
			(mergedConfig.version || {}),
		),
		git: mergeWithDefaults(
			defaultGitOptions,
			(mergedConfig.git || {}),
		),
		github: mergeWithDefaults(
			defaultGitHubOptions,
			(mergedConfig.github || {}),
		),
		release: mergeWithDefaults(
			defaultReleaseOptions,
			(mergedConfig.release || {}),
		),
		ci: mergeWithDefaults(
			{ autoDetect: true },
			(mergedConfig.ci || {}),
		),
		conventional: mergeWithDefaults(
			{ scopes: {}, types: {}, titles: {} },
			(mergedConfig.conventional || {}),
		),
		logLevel: mergeWithDefaults<Required<Exclude<CoreMonupOptions['logLevel'], undefined>>>(
			defaultCoreOptions.logLevel,
			mergedConfig.logLevel,
		),
		confirm: mergedConfig.confirm ?? (!isCI),
		isCI,
	};

	return resolved;
}

export { defaultOptions } from './defaults.ts';
export { logger } from './logger.ts';
export type { MonupOptions, ResolvedMonupOptions } from './types.ts';

/**
 * Helper function for type-safe monup configuration files
 * Use this in monup.config.ts for autocomplete and type checking
 * @example
 * ```typescript
 * import { defineConfig } from '@monup/options';
 *
 * export default defineConfig({
 *   git: { tagStrategy: 'package' },
 *   release: { dryRun: 'auto' },
 * });
 * ```
 */
export function defineConfig(config: MonupOptions): MonupOptions {
	return config;
}
