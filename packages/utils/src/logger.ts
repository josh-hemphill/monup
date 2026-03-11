/**
 * Shared logger utilities for all @monup packages
 */
import type { Logger } from 'loglevel';
import loglevel from 'loglevel';
import packageJson from '../package.json' with { type: 'json' };

/**
 * Creates a logger instance for a package
 * @param packageName - Name of the package (e.g., '@monup/git')
 * @returns Logger instance configured for the package
 */
export function createLogger(packageName: string): Logger {
	return loglevel.getLogger(packageName);
}

export const logger: Logger = loglevel.getLogger(packageJson.name);
