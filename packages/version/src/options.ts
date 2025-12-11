/**
 * Version package options
 */

export interface VersionOptions {
	strategy?: 'per-package' | 'synchronized';
	files?: string[];
	install?: boolean;
	ignoreScripts?: boolean;
}

export const defaultVersionOptions: Required<VersionOptions> = {
	strategy: 'per-package',
	files: [],
	install: false,
	ignoreScripts: false,
};
