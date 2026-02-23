/**
 * Spawns a process without shell interpolation to avoid path/quoting issues
 */
import { spawn } from 'node:child_process';

export interface SpawnProcessOptions {
	cwd?: string;
	capture?: 'inherit' | 'text' | 'lines';
}

/**
 * Runs a command via child_process.spawn (no shell) and optionally captures stdout.
 */
export async function spawnProcess(
	command: string,
	args: string[],
	options: SpawnProcessOptions = {},
): Promise<string | string[] | void> {
	const capture = options.capture ?? 'inherit';
	const usePipe = capture === 'text' || capture === 'lines';

	const proc = spawn(command, args, {
		cwd: options.cwd,
		stdio: usePipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
		windowsHide: true,
	});

	if (!usePipe) {
		await new Promise<void>((resolve, reject) => {
			proc.on('close', (code) => {
				if (code === 0) {
					resolve();
				}
				else {
					reject(new Error(`Process exited with code ${code ?? 'unknown'}`));
				}
			});
			proc.on('error', reject);
		});
		return;
	}

	const chunks: Buffer[] = [];
	const stdout = proc.stdout;
	if (stdout !== null) {
		for await (const chunk of stdout) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
		}
	}
	const output = Buffer.concat(chunks).toString('utf-8');

	await new Promise<void>((resolve, reject) => {
		proc.on('close', (code) => {
			if (code === 0) {
				resolve();
			}
			else {
				reject(new Error(`Process exited with code ${code ?? 'unknown'}`));
			}
		});
		proc.on('error', reject);
	});

	if (capture === 'lines') {
		return output.split(/\r?\n/).filter((line) => line.length > 0);
	}
	return output;
}
