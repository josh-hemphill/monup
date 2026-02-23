import { describe, expect, it } from 'vitest';
import { spawnProcess } from '../src/process.ts';

describe('spawnProcess', () => {
	it('captures text output', async () => {
		const result = await spawnProcess('node', ['-e', 'console.log("ok")'], { capture: 'text' });
		expect(typeof result).toBe('string');
		expect((result as string).trim()).toBe('ok');
	});

	it('captures lines output', async () => {
		const result = await spawnProcess('node', ['-e', 'console.log("a"); console.log("b")'], { capture: 'lines' });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual(['a', 'b']);
	});

	it('inherit completes without return value', async () => {
		const result = await spawnProcess('node', ['-e', 'console.log("ok")'], { capture: 'inherit' });
		expect(result).toBeUndefined();
	});
});
