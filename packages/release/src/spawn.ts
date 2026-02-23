/**
 * Spawns external commands without shell interpolation to avoid path/quoting issues
 */
import { spawnProcess } from '@monup/utils';

export interface SpawnCommandOptions {
	cwd?: string;
	capture?: 'inherit' | 'text' | 'lines';
}

/**
 * Runs a command via spawn (no shell) and optionally captures output.
 */
export async function spawnCommand(
	command: string,
	args: string[],
	options: SpawnCommandOptions = {},
): Promise<string | string[] | void> {
	const result = await spawnProcess(command, args, {
		cwd: options.cwd,
		capture: options.capture ?? 'inherit',
	});
	return result;
}
