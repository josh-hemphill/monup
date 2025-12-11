import { describe, expect, it } from 'vitest';
import { deepMerge, mergeWithDefaults } from '../src/merge.ts';

describe('deepMerge', () => {
	it('should merge simple objects', () => {
		const obj1 = { a: 1, b: 2 };
		const obj2 = { b: 3, c: 4 };
		const result = deepMerge(obj1, obj2);
		expect(result).toEqual({ a: 1, b: 3, c: 4 });
	});

	it('should merge nested objects', () => {
		const obj1 = { a: { x: 1, y: 2 } };
		const obj2 = { a: { y: 3, z: 4 } };
		const result = deepMerge(obj1, obj2 as unknown as Partial<typeof obj1>);
		expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
	});

	it('should overwrite arrays', () => {
		const obj1 = { items: [1, 2] };
		const obj2 = { items: [3, 4] };
		const result = deepMerge(obj1, obj2);
		expect(result).toEqual({ items: [3, 4] });
	});

	it('should handle multiple objects', () => {
		const obj1 = { a: 1 };
		const obj2 = { b: 2 };
		const obj3 = { c: 3 };
		const result = deepMerge(obj1, obj2 as unknown as Partial<typeof obj1>, obj3 as unknown as Partial<typeof obj1>);
		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it('should handle undefined values', () => {
		const obj1 = { a: 1 };
		const obj2 = undefined;
		const obj3 = { b: 2 };
		const result = deepMerge(obj1, obj2, obj3 as unknown as Partial<typeof obj1>);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should handle null values', () => {
		const obj1 = { a: 1 };
		const obj2 = { a: null };
		const result = deepMerge(obj1, obj2 as unknown as Partial<typeof obj1>);
		expect(result).toEqual({ a: null });
	});

	it('should handle deeply nested objects', () => {
		const obj1 = { a: { b: { c: 1 } } };
		const obj2 = { a: { b: { d: 2 } } };
		const result = deepMerge(obj1, obj2 as unknown as Partial<typeof obj1>);
		expect(result).toEqual({ a: { b: { c: 1, d: 2 } } });
	});
});

describe('mergeWithDefaults', () => {
	it('should merge defaults with provided values', () => {
		const defaults = { a: 1, b: 2, c: 3 };
		const provided = { b: 4 };
		const result = mergeWithDefaults(defaults, provided);
		expect(result).toEqual({ a: 1, b: 4, c: 3 });
	});

	it('should keep defaults for undefined values', () => {
		const defaults = { a: 1, b: 2 };
		const provided = { a: undefined, b: 3 };
		const result = mergeWithDefaults(defaults, provided);
		expect(result).toEqual({ a: 1, b: 3 });
	});

	it('should merge nested objects', () => {
		const defaults = { a: { x: 1, y: 2 } };
		const provided = { a: { y: 3 } };
		const result = mergeWithDefaults(defaults, provided);
		expect(result).toEqual({ a: { x: 1, y: 3 } });
	});

	it('should return defaults when provided is undefined', () => {
		const defaults = { a: 1, b: 2 };
		const result = mergeWithDefaults(defaults, undefined);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should return defaults when provided is null', () => {
		const defaults = { a: 1, b: 2 };
		const result = mergeWithDefaults(defaults, null as unknown as Partial<typeof defaults>);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('should handle arrays', () => {
		const defaults = { items: [1, 2] };
		const provided = { items: [3, 4] };
		const result = mergeWithDefaults(defaults, provided);
		expect(result).toEqual({ items: [3, 4] });
	});

	it('should handle deeply nested structures', () => {
		const defaults = { a: { b: { c: 1, d: 2 } } };
		const provided = { a: { b: { c: 3 } } };
		const result = mergeWithDefaults(defaults, provided);
		expect(result).toEqual({ a: { b: { c: 3, d: 2 } } });
	});
});
