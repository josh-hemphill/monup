/**
 * Changelog formatting utilities
 */
import type { ParsedCommit } from '@monup/git';
import type { ChangelogOptions } from './options.ts';
import { regex } from 'arkregex';

const SHORT_HASH_LENGTH = 7;

/** Builds commit URL by substituting {{hash}} in the template. */
export function buildCommitUrl(template: string, hash: string): string {
	return template.replace(/\{\{hash\}\}/g, hash);
}

/**
 * Formats a commit message for changelog
 */
export function formatCommitMessage(
	commit: ParsedCommit,
	options: ChangelogOptions,
): string {
	const useFullMessage = options.keepTypePrefix === true;
	let message = useFullMessage
		? commit.message
		: (typeof commit.subject === 'string' ? commit.subject : commit.message);

	if (options.capitalize && message.length > 0) {
		const colonSpace = ': ';
		const idx = message.indexOf(colonSpace);
		if (idx >= 0) {
			const afterColon = message.slice(idx + colonSpace.length);
			if (afterColon.length > 0) {
				message = message.slice(0, idx + colonSpace.length)
					+ afterColon.charAt(0).toUpperCase()
					+ afterColon.slice(1);
			}
		}
		else {
			message = message.charAt(0).toUpperCase() + message.slice(1);
		}
	}

	const scopeMap = options.scopeMap ?? {};

	// Apply scope mapping
	if (typeof commit.scope === 'string' && typeof scopeMap[commit.scope] === 'string') {
		const mappedScope = scopeMap[commit.scope];
		message = message.replace(
			regex(`^${commit.scope}:`, 'i'),
			`${mappedScope}:`,
		);
	}

	return message;
}

/**
 * Groups commits by type and scope
 */
export function groupCommits(
	commits: ParsedCommit[],
	options: ChangelogOptions,
): Map<string, Map<string, ParsedCommit[]>> {
	const grouped = new Map<string, Map<string, ParsedCommit[]>>();

	for (const commit of commits) {
		const type = typeof commit.type === 'string' ? commit.type : 'other';
		const scope = typeof commit.scope === 'string' ? commit.scope : '';

		if (!grouped.has(type)) {
			grouped.set(type, new Map());
		}

		const typeGroup = grouped.get(type);
		if (typeof typeGroup === 'undefined') {
			continue;
		}

		const scopeKey = options.group ? scope : '';

		if (!typeGroup.has(scopeKey)) {
			typeGroup.set(scopeKey, []);
		}

		const scopeCommits = typeGroup.get(scopeKey);
		if (typeof scopeCommits !== 'undefined') {
			scopeCommits.push(commit);
		}
	}

	return grouped;
}

/**
 * Formats commits into changelog sections
 */
export function formatChangelogSections(
	groupedCommits: Map<string, Map<string, ParsedCommit[]>>,
	options: ChangelogOptions,
): string[] {
	const sections: string[] = [];

	// Handle breaking changes first
	const breakingCommits: ParsedCommit[] = [];
	for (const [, scopes] of groupedCommits) {
		for (const [, commits] of scopes) {
			for (const commit of commits) {
				if (commit.breaking === true) {
					breakingCommits.push(commit);
				}
			}
		}
	}

	const commitUrlTemplateForLinks = options.resolvedCommitUrlTemplate ?? options.commitUrlTemplate ?? '';
	const addCommitLinks = options.commitLinks === true
		&& typeof commitUrlTemplateForLinks === 'string'
		&& commitUrlTemplateForLinks.length > 0;

	function formatBullet(commit: ParsedCommit, message: string): string {
		if (!addCommitLinks || commit.hash.length === 0) {
			return `- ${message}`;
		}
		const url = buildCommitUrl(commitUrlTemplateForLinks, commit.hash);
		const shortHash = commit.hash.slice(0, SHORT_HASH_LENGTH);
		return `- ${message} ([${shortHash}](${url}))`;
	}

	if (breakingCommits.length > 0) {
		const breakingTitle = options.titles?.breakingChanges ?? '🚨 Breaking Changes';
		sections.push(`### ${breakingTitle}\n`);
		for (const commit of breakingCommits) {
			const message = formatCommitMessage(commit, options);
			sections.push(formatBullet(commit, message));
		}
		sections.push('');
	}

	// Order types: typeOrder first (only those present), then any remaining in map order
	const typeOrder = options.typeOrder;
	const orderedTypes = (Array.isArray(typeOrder) && typeOrder.length > 0)
		? [
				...typeOrder.filter((t) => groupedCommits.has(t)),
				...[...groupedCommits.keys()].filter((t) => !typeOrder.includes(t)),
			]
		: [...groupedCommits.keys()];

	// Format by type
	for (const type of orderedTypes) {
		const scopes = groupedCommits.get(type);
		if (typeof scopes === 'undefined') {
			continue;
		}

		const typeConfig = options.types?.[type];
		if (typeof typeConfig === 'undefined') {
			continue;
		}

		const title = typeof typeConfig.title === 'string' ? typeConfig.title : type;
		sections.push(`### ${title}\n`);

		// Group by scope if enabled
		if (options.group) {
			const unscopedTitle = options.titles?.unscoped ?? 'Unscoped';
			for (const [scope, commits] of scopes) {
				if (scope.length > 0) {
					const mappedScope = options.scopeMap?.[scope] ?? scope;
					sections.push(`#### ${mappedScope}\n`);
				}
				else {
					sections.push(`#### ${unscopedTitle}\n`);
				}

				for (const commit of commits) {
					if (!commit.breaking) {
						// Skip breaking changes as they're already handled
						const message = formatCommitMessage(commit, options);
						sections.push(formatBullet(commit, message));
					}
				}

				sections.push('');
			}
		}
		else {
			for (const [, commits] of scopes) {
				for (const commit of commits) {
					if (!commit.breaking) {
						const message = formatCommitMessage(commit, options);
						sections.push(formatBullet(commit, message));
					}
				}
			}
		}

		sections.push('');
	}

	return sections;
}
