/**
 * Version package options
 */

/**
 * Options for version calculation and updates
 */
export interface VersionOptions {
	/**
	 * Strategy for versioning packages
	 * - 'per-package': Each package gets its own version based on its commits
	 * - 'synchronized': All packages share the same version
	 * @default 'per-package'
	 */
	strategy?: 'per-package' | 'synchronized';
	/**
	 * Additional files to update with version numbers
	 * @default []
	 */
	files?: string[];
	/**
	 * Whether to run package manager install after version updates
	 * @default false
	 */
	install?: boolean;
	/**
	 * Whether to ignore package.json scripts during install
	 * @default false
	 */
	ignoreScripts?: boolean;
}

export const defaultVersionOptions: Required<VersionOptions> = {
	strategy: 'per-package',
	files: [],
	install: false,
	ignoreScripts: false,
};
