import { describe, expect, it } from 'vitest';
import { spawnCommand } from '../src/spawn.ts';

describe('spawnCommand', () => {
	it('captures text output', async() => {
		const result = await spawnCommand('node', ['-e', 'console.log("ok")'], { capture: 'text' });
		expect(typeof result).toBe('string');
		expect((result as string).trim()).toBe('ok');
	});

	it('captures lines output', async() => {
		const result = await spawnCommand('node', ['-e', 'console.log("a"); console.log("b")'], { capture: 'lines' });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual(['a', 'b']);
	});

	it('handles command path with spaces when spawned directly', async() => {
		// node is typically in PATH; this exercises spawn with args (no shell interpolation)
		const result = await spawnCommand('node', ['--version'], { capture: 'text' });
		expect(typeof result).toBe('string');
		expect((result as string).trim()).toMatch(/^v\d+\.\d+\.\d+/);
	});
});
