/**
 * Plugin registry for package file version updaters
 */

export interface VersionUpdater {
	/**
	 * Checks if this updater can handle the given file
	 */
	canHandle: (filePath: string) => boolean;

	/**
	 * Reads the current version from the file
	 */
	readVersion: (filePath: string) => Promise<string | undefined>;

	/**
	 * Updates the version in the file
	 */
	updateVersion: (filePath: string, newVersion: string) => Promise<void>;
}

const updaters: VersionUpdater[] = [];

/**
 * Registers a version updater plugin
 */
export function registerUpdater(updater: VersionUpdater): void {
	updaters.push(updater);
}

/**
 * Gets the appropriate updater for a file
 */
export function getUpdater(filePath: string): VersionUpdater | undefined {
	return updaters.find((updater) => updater.canHandle(filePath));
}

/**
 * Gets all registered updaters
 */
export function getUpdaters(): VersionUpdater[] {
	return [...updaters];
}
