/**
 * Unified command execution for publishing packages
 * Handles both npm and JSR packages
 */

import type { DetectResult } from 'package-manager-detector';
import type { CommandConfig, PublishType } from './detector.ts';
import { resolveCommand } from 'package-manager-detector';
import { $ } from 'zx';
import { logger } from './logger.ts';

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
	}
	if (publishType === 'npm') {
		if (command.name === 'deno') {
			const executeWrapper = resolveCommand(command.agent, 'execute', ['npm', 'publish']);
			if (executeWrapper) {
				return executeWrapper;
			}
		}
		return {
			command: command.name,
			args: ['publish'],
		};
	}
	throw new Error(`Unknown publish type: ${publishType}`);
}

/**
 * Executes publish command for a package
 */
export async function executePublish(
	cwd: string,
	config: CommandConfig,
	dryRun: boolean,
	extraArgs: string[] = [],
): Promise<void> {
	const command = contextualizePublishCommand(config.command, config.publishType);

	command.args.push(...extraArgs);

	if (dryRun) {
		command.args.push('--dry-run');
	}

	logger.debug('Executing publish command', {
		...command,
		cwd,
	});

	// Execute the command directly using zx
	await $({ cwd })`${command.command} ${command.args}`;
}
