/**
 * Tag utility functions for extracting versions from git tags
 */

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;
const TEMPLATE_PLACEHOLDER_PATTERN = /%s/g;
const VERSION_PREFIX_PATTERN = /^v/;

/**
 * Extracts version from a scoped tag (package@version format)
 * @param tag - Tag string (e.g., '@monup/git@1.0.0')
 * @returns Version string or undefined if tag doesn't match format
 */
export function extractVersionFromScopedTag(tag: string): string | undefined {
	const separatorIndex = tag.lastIndexOf('@');
	if (separatorIndex <= 0 || separatorIndex >= tag.length - 1) {
		return undefined;
	}
	return tag.slice(separatorIndex + 1);
}

/**
 * Escapes special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
export function escapeRegex(str: string): string {
	return str.replace(REGEX_ESCAPE_PATTERN, '\\$&');
}

/**
 * Extracts version from a global tag using a template
 * @param tag - Tag string (e.g., 'v1.0.0')
 * @param template - Tag template (e.g., 'v%s')
 * @returns Version string or undefined if tag doesn't match template
 */
export function extractVersionFromTagWithTemplate(tag: string, template: string): string | undefined {
	// Escape special regex characters in the template, then replace %s with capture group
	const escapedTemplate = escapeRegex(template);
	const versionPattern = escapedTemplate.replace(TEMPLATE_PLACEHOLDER_PATTERN, '(.+)');
	const match = tag.match(new RegExp(`^${versionPattern}$`));
	if (match !== null && match.length > 1 && typeof match[1] === 'string') {
		return match[1];
	}
	return undefined;
}

/**
 * Extracts version from a global tag by removing 'v' prefix
 * @param tag - Tag string (e.g., 'v1.0.0')
 * @returns Version string with 'v' prefix removed
 */
export function extractVersionFromTag(tag: string): string {
	return tag.replace(VERSION_PREFIX_PATTERN, '');
}

/**
 * Extracts version from a tag based on tag strategy and template
 * @param tag - Tag string
 * @param tagStrategy - Tag strategy ('package' for scoped tags, 'global' for shared tags)
 * @param tagTemplate - Optional tag template for global tags (e.g., 'v%s')
 * @returns Version string or undefined if extraction fails
 */
export function extractVersionFromTagByStrategy(
	tag: string,
	tagStrategy: 'package' | 'global',
	tagTemplate?: string,
): string | undefined {
	if (tagStrategy === 'package') {
		return extractVersionFromScopedTag(tag);
	}

	// Global tag strategy
	if (typeof tagTemplate === 'string') {
		return extractVersionFromTagWithTemplate(tag, tagTemplate);
	}

	// Default: remove 'v' prefix
	return extractVersionFromTag(tag);
}
