/**
 * Core options that are at the root level of monup config
 * These are separate from package-specific options
 */
import type { ConventionalCommitType } from '@monup/changelog';

export interface ConventionalScope {
	[key: string]: unknown;
}

export interface ConventionalConfig {
	scopes?: Record<string, ConventionalScope>;
	types?: Record<string, ConventionalCommitType>;
	titles?: Record<string, string>;
}

export interface CIConfig {
	autoDetect?: boolean;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogLevelConfig {
	default?: LogLevel;
	packages?: Record<string, LogLevel>;
}

/**
 * Core monup options (root-level, not package-specific)
 */
export interface CoreMonupOptions {
	ci?: CIConfig;
	conventional?: ConventionalConfig;
	confirm?: boolean;
	logLevel?: LogLevelConfig;
}
