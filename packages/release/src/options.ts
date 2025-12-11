import type { AgentName } from 'package-manager-detector';

/**
 * Release package options
 */
export interface ReleaseOptions {
	dryRun?: boolean | 'auto';

	/**
	 * Override package manager for any package type (e.g., 'deno', 'pnpm', 'yarn')
	 */
	packageManager?: AgentName;

	/**
	 * Custom priority order for command detection (e.g., ['yarn', 'npm', 'pnpm'])
	 * Default: ['pnpm', 'yarn', 'npm', 'deno']
	 */
	commandPriority?: AgentName[];

	/**
	 * Commands to exclude from detection (e.g., ['corepack'])
	 * Default: ['corepack']
	 */
	excludedCommands?: AgentName[];

	/**
	 * Strict mode - error on conflicts vs auto-resolve
	 * Default: true
	 */
	strict?: boolean;

	/**
	 * Custom detection order for priority checks
	 * Default: ['checkExplicitOverride', 'checkWorkspaceContext', 'checkJsrDenoPreference', 'checkPackageManagerDetector', 'checkCommandAvailability']
	 */
	detectionOrder?: DetectionOrder;

	/**
	 * Extra publish arguments
	 */
	publishArgs?: string[];
}

export type DetectionOrder = (
	| 'checkExplicitOverride'
	| 'checkWorkspaceContext'
	| 'checkJsrDenoPreference'
	| 'checkPackageManagerDetector'
	| 'checkCommandAvailability'
)[];

/**
 * Release options with CI dependency
 * For standalone usage, only isCI boolean is needed
 */
export interface ReleaseOptionsWithDeps extends ReleaseOptions {
	isCI?: boolean;
}

export const defaultCommandPriority: AgentName[] = ['pnpm', 'yarn', 'npm', 'deno'];

/**
 * Default priority order for detection checks
 */
export const defaultDetectionOrder: DetectionOrder = [
	'checkExplicitOverride',
	'checkWorkspaceContext',
	'checkJsrDenoPreference',
	'checkPackageManagerDetector',
	'checkCommandAvailability',
];

type NonDefaultedReleaseOptionsKeys = 'packageManager';
type DefaultedReleaseOptions = Omit<ReleaseOptions, NonDefaultedReleaseOptionsKeys>;
type NonDefaultedReleaseOptions = Pick<ReleaseOptions, NonDefaultedReleaseOptionsKeys>;
export type ResolvedReleaseOptions = Required<DefaultedReleaseOptions> & NonDefaultedReleaseOptions;
export const defaultReleaseOptions: ResolvedReleaseOptions = {
	dryRun: 'auto',
	commandPriority: defaultCommandPriority,
	excludedCommands: [],
	strict: true,
	detectionOrder: defaultDetectionOrder,
	publishArgs: [],
};

export function resolveReleaseOptions<T extends ReleaseOptions>(options: T): ResolvedReleaseOptions & T {
	return {
		...defaultReleaseOptions,
		...options,
	};
}
