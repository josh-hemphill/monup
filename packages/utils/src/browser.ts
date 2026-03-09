/**
 * Opens an external URL using the platform default browser.
 */
import { platform } from 'node:process';
import { spawnProcess } from './process.ts';

/**
 * Tries to open a URL in the user's default browser.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
	const commands = platform === 'win32'
		? [['rundll32', ['url.dll,FileProtocolHandler', url]]]
		: platform === 'darwin'
			? [['open', [url]]]
			: [
					['xdg-open', [url]],
					['gio', ['open', url]],
				];

	for (const [command, args] of commands) {
		try {
			await spawnProcess(command, args);
			return true;
		}
		catch {
			continue;
		}
	}

	return false;
}
