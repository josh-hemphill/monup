/**
 * Changelog formatting utilities
 */
import type { ParsedCommit } from '@monup/git';
import type { ChangelogOptions } from './options.ts';
import { regex } from 'arkregex';

/**
 * Formats a commit message for changelog
 */
export function formatCommitMessage(
	commit: ParsedCommit,
	options: ChangelogOptions,
): string {
	const message = typeof commit.subject === 'string' ? commit.subject : commit.message;

	// Capitalize if enabled
	if (options.capitalize && message.length > 0) {
		const capitalized = message.charAt(0).toUpperCase() + message.slice(1);
		return capitalized;
	}

	const scopeMap = options.scopeMap ?? {};

	// Apply scope mapping
	if (typeof commit.scope === 'string' && typeof scopeMap[commit.scope] === 'string') {
		const mappedScope = scopeMap[commit.scope];
		return message.replace(
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

	if (breakingCommits.length > 0) {
		const breakingTitle = options.titles?.breakingChanges ?? '🚨 Breaking Changes';
		sections.push(`### ${breakingTitle}\n`);
		for (const commit of breakingCommits) {
			const message = formatCommitMessage(commit, options);
			sections.push(`- ${message}`);
		}
		sections.push('');
	}

	// Format by type
	for (const [type, scopes] of groupedCommits) {
		const typeConfig = options.types?.[type];
		if (typeof typeConfig === 'undefined') {
			continue;
		}

		const title = typeof typeConfig.title === 'string' ? typeConfig.title : type;
		sections.push(`### ${title}\n`);

		// Group by scope if enabled
		if (options.group) {
			for (const [scope, commits] of scopes) {
				if (scope) {
					const mappedScope = options.scopeMap?.[scope] ?? scope;
					sections.push(`#### ${mappedScope}\n`);
				}

				for (const commit of commits) {
					if (!commit.breaking) {
						// Skip breaking changes as they're already handled
						const message = formatCommitMessage(commit, options);
						sections.push(`- ${message}`);
					}
				}

				if (scope) {
					sections.push('');
				}
			}
		}
		else {
			for (const [, commits] of scopes) {
				for (const commit of commits) {
					if (!commit.breaking) {
						const message = formatCommitMessage(commit, options);
						sections.push(`- ${message}`);
					}
				}
			}
		}

		sections.push('');
	}

	return sections;
}
