/**
 * JSONC (JSON with Comments) parsing utilities
 */
import { parse, stripComments } from 'jsonc-parser';

/**
 * Parses JSONC (JSON with Comments) content
 * @param content - JSONC string content
 * @returns Parsed JSON object
 */
export function parseJsonc<T = unknown>(content: string): T {
	return parse(content) as T;
}

/**
 * Strips comments from JSONC content and returns valid JSON string
 * @param content - JSONC string content
 * @returns JSON string without comments
 */
export function stripJsoncComments(content: string): string {
	return stripComments(content);
}

/**
 * Type-safe JSON parsing utility
 * Parses JSON string and returns typed result
 * Note: This provides compile-time type safety but does not perform runtime validation
 * For runtime validation, consider using a schema validation library like zod
 * @param json - JSON string to parse
 * @returns Parsed JSON object with the specified type
 * @throws Error if JSON is invalid
 */
export function parseJson<T = unknown>(json: string): T {
	try {
		return JSON.parse(json) as T;
	}
	catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		throw new Error(`Failed to parse JSON: ${message}`);
	}
}
