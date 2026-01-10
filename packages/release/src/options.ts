import type { AgentName } from 'package-manager-detector';

/**
 * Release package options
 */
export interface ReleaseOptions {
	/**
	 * Whether to perform a dry run (validate without publishing)
	 * - true: Always dry run
	 * - false: Always publish
	 * - 'auto': Dry run in CI, publish otherwise
	 * @default 'auto'
	 */
	dryRun?: boolean | 'auto';

	/**
	 * Override package manager for any package type (e.g., 'deno', 'pnpm', 'yarn')
	 * If not provided, will be auto-detected
	 */
	packageManager?: AgentName;

	/**
	 * Custom priority order for command detection (e.g., ['yarn', 'npm', 'pnpm'])
	 * @default ['pnpm', 'yarn', 'npm', 'deno']
	 */
	commandPriority?: AgentName[];

	/**
	 * Commands to exclude from detection (e.g., ['corepack'])
	 * @default []
	 */
	excludedCommands?: AgentName[];

	/**
	 * Strict mode - error on conflicts vs auto-resolve
	 * @default true
	 */
	strict?: boolean;

	/**
	 * Custom detection order for priority checks
	 * @default ['checkExplicitOverride', 'checkWorkspaceContext', 'checkJsrDenoPreference', 'checkPackageManagerDetector', 'checkCommandAvailability']
	 */
	detectionOrder?: DetectionOrder;

	/**
	 * Extra arguments to pass to publish commands
	 * @default []
	 */
	publishArgs?: string[];
}

/**
 * Order of detection methods for package manager detection
 * Each method is checked in the specified order until a match is found
 */
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
	/**
	 * Whether running in CI environment
	 * Used to determine dry-run behavior when dryRun is 'auto'
	 */
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
