/**
 * Plugin registry for workspace detection
 */

export interface PackageInfo {
	name: string;
	path: string;
	root: string;
	packageFile?: string;
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
	const detectors: WorkspaceDetector[] = [];
	for (const detector of detectors) {
		if (await detector.canHandle(root)) {
			detectors.push(detector);
		}
	}
	return detectors;
}

/**
 * Gets all registered detectors
 */
export function getDetectors(): WorkspaceDetector[] {
	return [...detectors];
}
