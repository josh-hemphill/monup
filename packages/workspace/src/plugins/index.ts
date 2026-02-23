/**
 * Plugin registry for workspace detection
 */

export interface PackageInfo {
	name: string;
	path: string;
	root: string;
	/** Canonical manifest for reading version; one of the paths in packageFiles when present */
	packageFile?: string;
	/** All manifest paths for this logical package (version updates, commit). When set, packageFile is the canonical one. */
	packageFiles?: string[];
}

export interface WorkspaceDetector {
	/**
	 * Checks if this detector can handle the workspace
	 */
	canHandle: (root: string) => Promise<boolean>;

	/**
	 * Detects packages in the workspace
	 */
	detectPackages: (root: string) => Promise<PackageInfo[]>;
}

const detectors: WorkspaceDetector[] = [];

/**
 * Registers a workspace detector plugin
 */
export function registerDetector(detector: WorkspaceDetector): void {
	detectors.push(detector);
}

/**
 * Gets the appropriate detector for a workspace
 */
export async function getHandlers(root: string): Promise<WorkspaceDetector[]> {
	const handlers: WorkspaceDetector[] = [];
	for (const detector of detectors) {
		if (await detector.canHandle(root)) {
			handlers.push(detector);
		}
	}
	return handlers;
}

/**
 * Gets all registered detectors
 */
export function getDetectors(): WorkspaceDetector[] {
	return [...detectors];
}
