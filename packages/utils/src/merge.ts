/**
 * Deep merge utility for configuration objects
 */

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
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
		if (Object.prototype.hasOwnProperty.call(provided, key)) {
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
