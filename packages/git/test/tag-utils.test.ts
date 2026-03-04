import { describe, expect, it } from 'vitest';
import { extractVersionFromScopedTag } from '../src/tag-utils.ts';

describe('extractVersionFromScopedTag', () => {
	it('extracts version from unscoped package tags', () => {
		expect(extractVersionFromScopedTag('pkg@1.2.3')).toBe('1.2.3');
	});

	it('extracts version from scoped package tags', () => {
		expect(extractVersionFromScopedTag('@monup/cli@1.2.3')).toBe('1.2.3');
	});

	it('returns undefined for malformed tags', () => {
		expect(extractVersionFromScopedTag('@monup/cli')).toBeUndefined();
		expect(extractVersionFromScopedTag('@1.2.3')).toBeUndefined();
	});
});
