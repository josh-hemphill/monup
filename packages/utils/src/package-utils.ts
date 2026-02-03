/**
 * Shared utilities for package operations
 */

/**
 * Extracts package name from config, falling back to package path if name is not defined
 * @param configName - Package name from config (may be undefined)
 * @param packagePath - Path to the package (used as fallback)
 * @returns Package name or path
 */
export function extractPackageName(configName: string | undefined, packagePath: string): string {
	return typeof configName === 'string' ? configName : 'root';
}

