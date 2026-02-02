import { describe, expect, it } from 'vitest';
import { coerceValue, deepMerge, mergeWithDefaults, parseConfigOverrides, setByPath } from '../src/merge.ts';

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

describe('coerceValue', () => {
	it('should coerce "true" to boolean true', () => {
		expect(coerceValue('true')).toBe(true);
	});

	it('should coerce "false" to boolean false', () => {
		expect(coerceValue('false')).toBe(false);
	});

	it('should coerce numeric strings to numbers', () => {
		expect(coerceValue('123')).toBe(123);
		expect(coerceValue('0')).toBe(0);
		expect(coerceValue('-42')).toBe(-42);
		expect(coerceValue('3.14')).toBe(3.14);
	});

	it('should keep non-numeric, non-boolean strings as strings', () => {
		expect(coerceValue('hello')).toBe('hello');
		expect(coerceValue('git.push')).toBe('git.push');
		expect(coerceValue('')).toBe('');
	});
});

describe('setByPath', () => {
	it('should set a simple path', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'key', 'value');
		expect(obj).toEqual({ key: 'value' });
	});

	it('should set a nested path', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'git.push', false);
		expect(obj).toEqual({ git: { push: false } });
	});

	it('should set a deeply nested path', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'a.b.c.d', 42);
		expect(obj).toEqual({ a: { b: { c: { d: 42 } } } });
	});

	it('should overwrite existing values', () => {
		const obj: Record<string, unknown> = { git: { push: true, tag: true } };
		setByPath(obj, 'git.push', false);
		expect(obj).toEqual({ git: { push: false, tag: true } });
	});

	it('should create intermediate objects', () => {
		const obj: Record<string, unknown> = { existing: 'value' };
		setByPath(obj, 'new.nested.key', 'newValue');
		expect(obj).toEqual({ existing: 'value', new: { nested: { key: 'newValue' } } });
	});
});

describe('parseConfigOverrides', () => {
	it('should parse single path=value entry', () => {
		const result = parseConfigOverrides(['git.push=false']);
		expect(result).toEqual({ git: { push: false } });
	});

	it('should parse multiple entries', () => {
		const result = parseConfigOverrides(['git.push=false', 'release.dryRun=true']);
		expect(result).toEqual({ git: { push: false }, release: { dryRun: true } });
	});

	it('should handle entries with = in value', () => {
		const result = parseConfigOverrides(['key=value=with=equals']);
		expect(result).toEqual({ key: 'value=with=equals' });
	});

	it('should skip entries without =', () => {
		const result = parseConfigOverrides(['noequals', 'git.push=false']);
		expect(result).toEqual({ git: { push: false } });
	});

	it('should skip entries with empty path', () => {
		const result = parseConfigOverrides(['=value', 'git.push=false']);
		expect(result).toEqual({ git: { push: false } });
	});

	it('should coerce values appropriately', () => {
		const result = parseConfigOverrides([
			'bool.true=true',
			'bool.false=false',
			'num.int=42',
			'str.val=hello',
		]);
		expect(result).toEqual({
			bool: { true: true, false: false },
			num: { int: 42 },
			str: { val: 'hello' },
		});
	});

	it('should handle empty array', () => {
		const result = parseConfigOverrides([]);
		expect(result).toEqual({});
	});

	it('should allow later entries to overwrite earlier ones', () => {
		const result = parseConfigOverrides(['git.push=true', 'git.push=false']);
		expect(result).toEqual({ git: { push: false } });
	});
});
