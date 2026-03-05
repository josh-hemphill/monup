import type { MonupOptions } from '../src/types.ts';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../src/index.ts';

describe('resolveOptions', () => {
	it('should return default options when no overrides provided', async() => {
		const result = await resolveOptions();
		expect(result).toBeDefined();
		expect(result.changelog).toBeDefined();
		expect(result.version).toBeDefined();
		expect(result.git).toBeDefined();
		expect(result.github).toBeDefined();
		expect(result.release).toBeDefined();
		expect(typeof result.isCI).toBe('boolean');
		expect(typeof result.confirm).toBe('boolean');
	});

	it('should merge overrides with defaults', async() => {
		const overrides: Partial<MonupOptions> = {
			changelog: {
				location: 'CUSTOM_CHANGELOG.md',
			},
		};
		const result = await resolveOptions(overrides);
		expect(result.changelog.location).toBe('CUSTOM_CHANGELOG.md');
	});

	it('should handle nested option merging', async() => {
		const overrides: Partial<MonupOptions> = {
			version: {
				files: ['package.json'],
			},
		};
		const result = await resolveOptions(overrides);
		expect(result.version.files).toEqual(['package.json']);
	});

	it('should allow explicit confirm override', async() => {
		const overrides: Partial<MonupOptions> = {
			confirm: false,
		};
		const result = await resolveOptions(overrides);
		expect(result.confirm).toBe(false);
	});

	it('should merge conventional config', async() => {
		const overrides: Partial<MonupOptions> = {
			conventional: {
				types: {
					custom: { title: 'Custom' },
				},
			},
		};
		const result = await resolveOptions(overrides);
		expect(result.conventional.types?.custom?.title).toBe('Custom');
		expect(result.conventional.scopes).toBeDefined();
		expect(result.conventional.titles).toBeDefined();
	});
});
