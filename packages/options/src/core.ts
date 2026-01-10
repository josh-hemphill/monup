/**
 * Core options that are at the root level of monup config
 * These are separate from package-specific options
 */
import type { ConventionalCommitType } from '@monup/changelog';

/**
 * Configuration for a conventional commit scope
 */
export interface ConventionalScope {
	[key: string]: unknown;
}

/**
 * Configuration for conventional commits
 */
export interface ConventionalConfig {
	/**
	 * Scope configurations
	 */
	scopes?: Record<string, ConventionalScope>;
	/**
	 * Commit type configurations
	 */
	types?: Record<string, ConventionalCommitType>;
	/**
	 * Custom titles for changelog sections
	 */
	titles?: Record<string, string>;
}

/**
 * CI environment configuration
 */
export interface CIConfig {
	/**
	 * Whether to automatically detect CI environment
	 * @default true
	 */
	autoDetect?: boolean;
}

/**
 * Log level options
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log level configuration
 */
export interface LogLevelConfig {
	/**
	 * Default log level for all packages
	 */
	default?: LogLevel;
	/**
	 * Per-package log level overrides
	 */
	packages?: Record<string, LogLevel>;
}

/**
 * Core monup options (root-level, not package-specific)
 */
export interface CoreMonupOptions {
	/**
	 * CI environment configuration
	 */
	ci?: CIConfig;
	/**
	 * Conventional commit configuration
	 */
	conventional?: ConventionalConfig;
	/**
	 * Whether to require confirmation before executing operations
	 * @default false
	 */
	confirm?: boolean;
	/**
	 * Log level configuration
	 */
	logLevel?: LogLevelConfig;
}
