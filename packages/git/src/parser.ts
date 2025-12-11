/**
 * Git commit parsing utilities
 */
import { regex } from 'arkregex';

export interface ParsedCommit {
	hash: string;
	message: string;
	body?: string;
	author: string;
	date: string;
	type?: string;
	scope?: string;
	subject?: string;
	breaking?: boolean;
	packages?: string[];
}

/**
 * Parses a conventional commit message
 * Supports format: type(scope): subject
 * Also handles BREAKING CHANGE and exclamation mark syntax
 */
const breakingExclamationRegex = regex('^(?<prefix>.+)!\\s*:');
const conventionalCommitRegex = regex('^(?<type>\\w+)(?:\\((?<scope>[^)]+)\\))?(?<exclamation>!?):(?<subject>.+)$');

export function parseConventionalCommit(message: string): {
	type?: string;
	scope?: string;
	subject?: string;
	breaking: boolean;
} {
	const breakingMatch = breakingExclamationRegex.exec(message);
	const hasExclamation = breakingMatch !== null;
	const messageToParse = (hasExclamation && breakingMatch !== null && typeof breakingMatch.groups?.prefix === 'string')
		? `${breakingMatch.groups.prefix}:`
		: message;

	const conventionalMatch = conventionalCommitRegex.exec(messageToParse);

	if (conventionalMatch === null || conventionalMatch.groups === undefined) {
		return {
			breaking: hasExclamation || message.includes('BREAKING CHANGE'),
			subject: message,
		};
	}

	const { type, scope, exclamation, subject } = conventionalMatch.groups;

	return {
		type: typeof type === 'string' ? type : undefined,
		scope: typeof scope === 'string' ? scope : undefined,
		subject: typeof subject === 'string' ? subject.trim() : message,
		breaking: hasExclamation || exclamation === '!' || message.includes('BREAKING CHANGE'),
	};
}

/**
 * Parses git log output into structured commit data
 * Expects format: %H|%an|%ae|%ad|%s|%b
 */
export function parseGitLog(output: string): ParsedCommit[] {
	const lines = output.trim().split('\n');
	const commits: ParsedCommit[] = [];

	for (const line of lines) {
		if (!line.trim()) {
			continue;
		}

		const parts = line.split('|');
		if (parts.length < 5) {
			continue;
		}

		const [hash, author, email, date, subject, ...bodyParts] = parts;
		const body = bodyParts.join('|').trim() || undefined;

		const parsed = parseConventionalCommit(subject);

		commits.push({
			hash,
			message: subject,
			body,
			author: `${author} <${email}>`,
			date,
			type: parsed.type,
			scope: parsed.scope,
			subject: parsed.subject,
			breaking: parsed.breaking,
		});
	}

	return commits;
}
