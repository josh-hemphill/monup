/**
 * Spawns git without shell interpolation to avoid path/quoting issues
 */
import { cwd } from 'node:process';
import { spawnProcess } from '@monup/utils';

export interface SpawnGitOptions {
	cwd?: string;
	stdio?: 'inherit' | 'pipe';
}

/**
 * Runs git via spawn (no shell) and waits for completion.
 * For stdio: 'inherit', output goes to terminal. For 'pipe', returns collected stdout.
 */
export async function spawnGit(
	args: string[],
	options: SpawnGitOptions = {},
): Promise<{ stdout: string }> {
	const root = options.cwd ?? cwd();
	const usePipe = options.stdio === 'pipe';

	const result = await spawnProcess('git', args, {
		cwd: root,
		capture: usePipe ? 'text' : 'inherit',
	});

	if (!usePipe) {
		return { stdout: '' };
	}
	return { stdout: typeof result === 'string' ? result : '' };
}
