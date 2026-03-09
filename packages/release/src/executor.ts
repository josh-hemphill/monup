/**
 * Unified command execution for publishing packages
 * Handles both npm and JSR packages
 */

import type { DetectResult } from 'package-manager-detector';
import type { CommandConfig, PublishType } from './detector.ts';
import { resolveCommand } from 'package-manager-detector';
import { logger } from './logger.ts';
import { spawnCommand } from './spawn.ts';

export interface ContextualizedCommand {
	command: string;
	args: string[];
}

export function contextualizePublishCommand(command: DetectResult, publishType: PublishType): ContextualizedCommand {
	if (publishType === 'jsr') {
		if (command.name === 'deno') {
			return {
				command: 'deno',
				args: ['publish'],
			};
		}

		const executeWrapper = resolveCommand(command.agent, 'execute', ['jsr', 'publish']);
		if (executeWrapper) {
			return executeWrapper;
		}
		else {
			throw new Error(`No execute wrapper found for ${command.name}`);
		}
	}
	else if (publishType === 'npm') {
		// For npm-compatible package managers (npm, pnpm, yarn), use their native publish command
		if (command.name === 'npm' || command.name === 'pnpm' || command.name === 'yarn') {
			return {
				command: command.name,
				args: ['publish'],
			};
		}
		// For other package managers (e.g., deno), use execute wrapper
		const executeWrapper = resolveCommand(command.agent, 'execute', ['npm', 'publish']);
		if (executeWrapper) {
			return executeWrapper;
		}
		throw new Error(`No execute wrapper found for ${command.name}`);
	}
	throw new Error(`Unknown publish type: ${publishType as string}`);
}

/**
 * Executes publish command for a package
 */
export async function executePublish(
	cwd: string,
	config: CommandConfig,
	dryRun: boolean,
	extraArgs: string[] = [],
	allowDirty = false,
): Promise<void> {
	logger.trace('Contextualizing publish command', { config });
	const command = contextualizePublishCommand(config.command, config.publishType);
	logger.trace('Contextualized publish command', { command });

	if (allowDirty) {
		if (config.publishType === 'npm' && config.command.name === 'pnpm') {
			command.args.push('--no-git-checks');
		}
		else if (config.publishType === 'jsr' && config.command.name === 'deno') {
			command.args.push('--allow-dirty');
		}
		else if (config.publishType === 'jsr' && config.command.name === 'pnpm') {
			// JSR npm compat package passes through to deno under the hood
			command.args.push('--allow-dirty');
		}
		else {
			throw new Error(`Allow dirty is not supported for ${config.publishType} ${config.command.name}`);
		}
	}

	command.args.push(...extraArgs);

	if (dryRun) {
		command.args.push('--dry-run');
	}

	logger.debug('Executing publish command', {
		...command,
		cwd,
	});

	await spawnCommand(command.command, command.args, { cwd, capture: 'inherit' });
}
