import { normalizePathForComparison } from '@monup/utils';
import { describe, expect, it } from 'vitest';

describe('normalizePathForComparison', () => {
	it('converts backslashes to forward slashes', () => {
		expect(normalizePathForComparison('packages\\cli\\src')).toBe('packages/cli/src');
	});

	it('leaves forward slashes unchanged', () => {
		expect(normalizePathForComparison('packages/cli/src')).toBe('packages/cli/src');
	});

	it('handles Windows absolute paths', () => {
		expect(normalizePathForComparison('E:\\Share\\dev\\monup\\packages\\cli')).toBe('E:/Share/dev/monup/packages/cli');
	});
});
