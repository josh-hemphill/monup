/**
 * Deep merge utility for configuration objects
 */

/**
 * Coerces a string value to its appropriate type
 * - "true" / "false" → boolean
 * - Numeric strings → number
 * - Otherwise keeps as string
 */
export function coerceValue(value: string): unknown {
	// Boolean coercion
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}

	// Number coercion (only for valid numeric strings)
	if (value !== '' && !Number.isNaN(Number(value))) {
		return Number(value);
	}

	// Keep as string
	return value;
}

/**
 * Sets a value in a nested object using a dot-path key
 * Creates intermediate objects as needed
 * @example setByPath({}, 'git.push', false) → { git: { push: false } }
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
	const keys = path.split('.');
	let current: Record<string, unknown> = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (typeof current[key] !== 'object' || current[key] === null) {
			current[key] = {};
		}
		current = current[key] as Record<string, unknown>;
	}

	const lastKey = keys.at(-1);
	current[lastKey] = value;
}

/**
 * Parses an array of "path=value" strings into a nested config object
 * @example parseConfigOverrides(['git.push=false', 'release.dryRun=true'])
 *          → { git: { push: false }, release: { dryRun: true } }
 */
export function parseConfigOverrides(entries: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const entry of entries) {
		// Split on first '=' only
		const eqIndex = entry.indexOf('=');
		if (eqIndex === -1) {
			// No '=' found, skip this entry
			continue;
		}

		const path = entry.slice(0, eqIndex);
		const rawValue = entry.slice(eqIndex + 1);

		if (path.length === 0) {
			// Empty path, skip
			continue;
		}

		const value = coerceValue(rawValue);
		setByPath(result, path, value);
	}

	return result;
}

/**
 * Deep merges multiple objects, with later objects taking precedence
 */
export function deepMerge<T extends Record<string, unknown>>(
	...objects: Array<Partial<T> | undefined>
): T {
	const result = {} as T;

	for (const obj of objects) {
		if (typeof obj === 'undefined' || obj === null) {
			continue;
		}

		for (const key in obj) {
			if (Object.hasOwn(obj, key)) {
				const value = obj[key];

				// If both values are objects (and not arrays or null), merge recursively
				if (
					value !== null
					&& typeof value === 'object'
					&& !Array.isArray(value)
					&& result[key] !== null
					&& typeof result[key] === 'object'
					&& !Array.isArray(result[key])
				) {
					result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>) as T[Extract<keyof T, string>];
				}
				else {
					// Otherwise, overwrite with the new value
					result[key] = value as T[Extract<keyof T, string>];
				}
			}
		}
	}

	return result;
}

/**
 * Merges defaults with provided values, applying defaults for undefined values
 */
export function mergeWithDefaults<T extends Record<string, unknown>>(
	defaults: T,
	provided: Partial<T> | undefined | Record<string, unknown>,
): T {
	if (typeof provided === 'undefined' || provided === null) {
		return { ...defaults };
	}

	const result = { ...defaults };

	for (const key in provided) {
		if (Object.hasOwn(provided, key)) {
			const providedValue = provided[key];
			const defaultValue = defaults?.[key];

			// If both are objects (and not arrays or null), merge recursively
			if (
				providedValue !== null
				&& typeof providedValue === 'object'
				&& !Array.isArray(providedValue)
				&& defaultValue !== null
				&& typeof defaultValue === 'object'
				&& !Array.isArray(defaultValue)
			) {
				// Use Extract<keyof T, string> instead of typeof key to address type indexing error
				result[key as Extract<keyof T, string>] = mergeWithDefaults(
					defaultValue as Record<string, unknown>,
					providedValue as Record<string, unknown>,
				) as T[Extract<keyof T, string>];
			}
			else if (providedValue !== undefined) {
				// Use provided value if it's not undefined
				result[key as Extract<keyof T, string>] = providedValue as T[Extract<keyof T, string>];
			}
			// If providedValue is undefined, keep the default
		}
	}

	return result;
}
