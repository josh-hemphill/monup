/**
 * Package manager detection logic
 * Uses package-manager-detector library and workspace context analysis
 */

import type { PackageInfo } from '@monup/workspace';
import type { AgentName, DetectResult } from 'package-manager-detector';
import type { ResolvedReleaseOptions } from './options.ts';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { normalizePathForComparison, parseJson, parseJsonc } from '@monup/utils';
import { detect } from 'package-manager-detector';
import { glob, which } from 'zx';
import { logger } from './logger.ts';
import { resolveAgent } from './pmd-internals.ts';
import { spawnCommand } from './spawn.ts';

const TRAILING_SLASH_PATTERN = /\/$/;
const YAML_QUOTE_PATTERN = /['"]/g;

export type PublishType = 'npm' | 'jsr';

/**
 * Command configuration result
 */
export interface CommandConfig {
	command: DetectResult;
	publishType: PublishType;
}

/**
 * Detection context for priority functions
 */
export interface DetectionContext {
	pkg: PackageInfo;
	publishType: PublishType;
	excludedCommands: AgentName[];
	priority: AgentName[];
	strict: boolean;
}

/**
 * Determines package type from package file
 */
function determinePackageType(pkg: PackageInfo): PublishType | undefined {
	if (typeof pkg.packageFile === 'string') {
		if (pkg.packageFile.endsWith('package.json')) {
			return 'npm';
		}
		if (pkg.packageFile.endsWith('jsr.json')) {
			return 'jsr';
		}
	}
}

/**
 * Checks if a command is available in PATH
 */
async function getCommandAvailability(
	command: string,
	excludedCommands: string[],
): Promise<string | undefined> {
	if (excludedCommands?.includes(command)) {
		return undefined;
	}

	try {
		const path = await which(command, { nothrow: true });
		return typeof path === 'string' && path.length > 0 ? path : undefined;
	}
	catch {
		return undefined;
	}
}

async function getCommandRunVersion(commandPath: string): Promise<string | undefined> {
	try {
		const result = await spawnCommand(commandPath, ['--version'], { capture: 'text' });
		return typeof result === 'string' ? result.trim() : undefined;
	}
	catch(error: unknown) {
		logger.debug('Failed to get command version', {
			commandPath,
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	}
}

/**
 * Checks if a package path is covered by a workspace pattern
 */
async function isPackageInWorkspace(
	packagePath: string,
	workspaceRoot: string,
	pattern: string,
): Promise<boolean> {
	const normPackagePath = normalizePathForComparison(resolve(packagePath)).replace(TRAILING_SLASH_PATTERN, '');
	try {
		// Use native workspaceRoot for glob cwd so behavior is correct on both Windows and Unix
		const matches = await glob(pattern, { cwd: workspaceRoot, onlyDirectories: true, absolute: true });
		return matches.some((match) => {
			const normMatch = normalizePathForComparison(match).replace(TRAILING_SLASH_PATTERN, '');
			return normPackagePath === normMatch || normPackagePath.startsWith(`${normMatch}/`);
		});
	}
	catch {
		return false;
	}
}

/** Node fs exists check so workspace detection is consistent across environments. */
async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	}
	catch {
		return false;
	}
}

/**
 * Workspace detection result
 */
interface WorkspaceDetection {
	manager: AgentName;
	workspaceRoot: string;
}

/**
 * Analyzes workspace context at workspace root
 * Collects all workspace managers that cover the target package
 * Returns preferred package manager based on commandPriority
 */
async function analyzeWorkspace(
	workspaceRoot: string,
	packagePath: string,
	commandPriority: string[],
): Promise<AgentName | undefined> {
	workspaceRoot = resolve(workspaceRoot);
	packagePath = resolve(packagePath);
	const detections: WorkspaceDetection[] = [];

	// Check for pnpm-workspace.yaml
	const pnpmWorkspaceFile = resolve(workspaceRoot, 'pnpm-workspace.yaml');
	if (await pathExists(pnpmWorkspaceFile)) {
		try {
			const content = await readFile(pnpmWorkspaceFile, 'utf-8');
			const lines = content.split('\n');
			let inPackages = false;
			const patterns: string[] = [];

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith('packages:')) {
					inPackages = true;
					continue;
				}
				if (inPackages && trimmed.startsWith('-')) {
					const pattern = trimmed.slice(1).trim().replace(YAML_QUOTE_PATTERN, '');
					patterns.push(pattern);
				}
				if (inPackages && typeof trimmed === 'string' && trimmed.length > 0 && !trimmed.startsWith('-') && !trimmed.startsWith('#')) {
					inPackages = false;
				}
			}

			// Check if package is in any pattern
			for (const pattern of patterns) {
				if (await isPackageInWorkspace(packagePath, workspaceRoot, pattern)) {
					detections.push({ manager: 'pnpm', workspaceRoot });
					break;
				}
			}
		}
		catch {
			// Invalid pnpm-workspace.yaml, ignore
		}
	}

	// Check for package.json with workspaces field
	const packageJsonPath = resolve(workspaceRoot, 'package.json');
	if (await pathExists(packageJsonPath)) {
		try {
			const content = await readFile(packageJsonPath, 'utf-8');
			const pkg = parseJson<{
				workspaces?: string[] | { packages?: string[] };
				packageManager?: string;
				[key: string]: unknown;
			}>(content);

			const workspaces = Array.isArray(pkg.workspaces)
				? pkg.workspaces
				: (typeof pkg.workspaces === 'object' && pkg.workspaces !== null && 'packages' in pkg.workspaces && Array.isArray(pkg.workspaces.packages))
						? pkg.workspaces.packages
						: [];

			if (workspaces.length > 0) {
				// Check if package is in any workspace pattern
				for (const workspace of workspaces) {
					if (await isPackageInWorkspace(packagePath, workspaceRoot, workspace)) {
						// Check for packageManager field
						if (typeof pkg.packageManager === 'string') {
							const manager = pkg.packageManager.split('@')[0];
							detections.push({ manager: manager as AgentName, workspaceRoot });
						}
						else {
							// Default to npm for npm workspaces
							detections.push({ manager: 'npm', workspaceRoot });
						}
						break;
					}
				}
			}
		}
		catch {
			// Invalid package.json, ignore
		}
	}

	// Check for deno.json with workspace field
	const denoJsonPath = resolve(workspaceRoot, 'deno.json');
	if (await pathExists(denoJsonPath)) {
		try {
			const content = await readFile(denoJsonPath, 'utf-8');
			const config = parseJsonc<{
				workspace?: string[] | { packages?: string[] };
				[key: string]: unknown;
			}>(content);

			const workspaces = Array.isArray(config.workspace)
				? config.workspace
				: [];

			if (workspaces.length > 0) {
				// Check if package is in any workspace pattern
				for (const workspace of workspaces) {
					if (await isPackageInWorkspace(packagePath, workspaceRoot, workspace)) {
						detections.push({ manager: 'deno', workspaceRoot });
						break;
					}
				}
			}
		}
		catch {
			// Invalid deno.json, ignore
		}
	}

	// If multiple detections, use commandPriority to resolve
	if (detections.length > 0) {
		// Sort by commandPriority order
		const sorted = detections.sort((a, b) => {
			const aIndex = commandPriority.indexOf(a.manager);
			const bIndex = commandPriority.indexOf(b.manager);
			// If not in priority list, put at end
			if (aIndex === -1 && bIndex === -1) {
				return 0;
			}
			if (aIndex === -1) {
				return 1;
			}
			if (bIndex === -1) {
				return -1;
			}
			return aIndex - bIndex;
		});

		const selected = sorted[0];
		logger.debug('Workspace context detected', {
			workspaceRoot,
			packagePath,
			detections: detections.map((d) => d.manager),
			selected: selected.manager,
		});
		return selected.manager;
	}

	return undefined;
}

/**
 * Priority 1: Explicit Override
 */
async function checkExplicitOverride(
	ctx: DetectionContext,
	options: ResolvedReleaseOptions,
): Promise<DetectResult | undefined> {
	const pkgManager = options.packageManager;
	if (typeof pkgManager !== 'string') {
		return undefined;
	}

	const command = await getCommandAvailability(pkgManager, ctx.excludedCommands);
	if (typeof command === 'string') {
		const version = await getCommandRunVersion(command);
		logger.debug('Using package manager override', {
			package: ctx.pkg.name,
			command: pkgManager,
			version,
		});
		const agent = resolveAgent({ name: pkgManager, ver: version });
		if (agent !== null) {
			return agent;
		}
	}

	if (ctx.strict) {
		throw new Error(
			`Specified package manager not available: ${options.packageManager}`,
		);
	}
	logger.warn('Specified package manager not available, continuing detection', {
		package: ctx.pkg.name,
		command: options.packageManager,
	});
	return undefined;
}

/**
 * Priority 2: Workspace context
 */
async function checkWorkspaceContext(
	ctx: DetectionContext,
): Promise<DetectResult | undefined> {
	const workspaceManager = await analyzeWorkspace(
		ctx.pkg.root,
		ctx.pkg.path,
		ctx.priority,
	);
	if (typeof workspaceManager === 'string') {
		const command = await getCommandAvailability(workspaceManager, ctx.excludedCommands);
		if (typeof command === 'string') {
			const agent = resolveAgent({ name: workspaceManager, ver: undefined });
			if (agent !== null) {
				return agent;
			}
		}
	}
	return undefined;
}

/**
 * Priority 2.5: JSR-specific deno preference
 */
async function checkJsrDenoPreference(
	ctx: DetectionContext,
): Promise<DetectResult | undefined> {
	if (ctx.publishType !== 'jsr') {
		return undefined;
	}

	const denoJsonPath = join(ctx.pkg.path, 'deno.json');
	if (await pathExists(denoJsonPath)) {
		const deno = await getCommandAvailability('deno', ctx.excludedCommands);
		if (typeof deno === 'string') {
			const version = await getCommandRunVersion(deno);
			const agent = resolveAgent({ name: 'deno', ver: version });
			if (agent !== null) {
				return agent;
			}
		}
	}
	return undefined;
}

/**
 * Priority 3: package-manager-detector
 */
async function checkPackageManagerDetector(
	ctx: DetectionContext,
): Promise<DetectResult | undefined> {
	try {
		const detected = await detect({
			cwd: ctx.pkg.path,
			stopDir: ctx.pkg.path,
			strategies: ['install-metadata', 'lockfile'],
		});
		if (detected) {
			const detectedManager = detected.name;
			const command = await getCommandAvailability(detectedManager, ctx.excludedCommands);
			if (typeof command === 'string') {
				logger.debug('Using package-manager-detector result', {
					package: ctx.pkg.name,
					command: detected,
				});
				return detected;
			}
		}
	}
	catch(error: unknown) {
		logger.debug('package-manager-detector failed', {
			package: ctx.pkg.name,
			error: error instanceof Error ? error.message : String(error),
		});
	}
	return undefined;
}

/**
 * Priority 4: Command availability with priority order
 */
async function checkCommandAvailability(
	ctx: DetectionContext,
): Promise<DetectResult | undefined> {
	for (const cmd of ctx.priority) {
		if (!ctx.excludedCommands.includes(cmd)) {
			const available = await getCommandAvailability(cmd, ctx.excludedCommands);
			if (typeof available === 'string') {
				const version = await getCommandRunVersion(available);
				const agent = resolveAgent({ name: cmd, ver: version });
				if (agent !== null) {
					return agent;
				}
			}
		}
	}
	return undefined;
}

/**
 * Detects package manager for a package
 * Unified function for both npm and JSR packages
 * Supports custom detection order via options
 */
export async function detectPackageManager(
	pkg: PackageInfo,
	options: ResolvedReleaseOptions,
): Promise<CommandConfig> {
	const publishType = determinePackageType(pkg);

	if (typeof publishType !== 'string') {
		throw new TypeError(`Unknown package type for package: ${pkg.name}`);
	}

	const excludedCommands = options.excludedCommands ?? ['corepack'];
	const priority = options.commandPriority;
	const strict = options.strict !== false;

	const ctx: DetectionContext = {
		pkg,
		publishType,
		excludedCommands,
		priority,
		strict,
	};

	// Use custom detection order if provided, otherwise use default
	const detectionOrder = options.detectionOrder;

	const detectorMap = {
		checkExplicitOverride,
		checkWorkspaceContext,
		checkJsrDenoPreference,
		checkPackageManagerDetector,
		checkCommandAvailability,
	};
	// Run detection checks in order
	for (const checkName of detectionOrder) {
		let result: DetectResult | undefined;
		const detector = detectorMap[checkName];
		if (typeof detector === 'function') {
			result = await detector(ctx, options);
		}
		else {
			logger.warn('Unknown detection check', { checkName });
			continue;
		}

		if (result) {
			return {
				command: result,
				publishType,
			};
		}
	}

	// Fallback: error
	if (strict) {
		throw new Error('No package manager available. Install deno or an npm-compatible manager (npm, pnpm, yarn).');
	}

	throw new Error('No package manager available');
}
