/**
 * Cross-platform path normalization for comparisons
 */

export function normalizePathForComparison(p: string): string {
	return p.replaceAll('\\', '/');
}
