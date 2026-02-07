import type { PackageInfo } from './filter.ts';
import type { ParsedCommit } from './parser.ts';
import { cwd } from 'node:process';
import { relative } from 'node:path';
/**
 * Streaming git log parser that maps files to packages
 */
import { regex } from 'arkregex';
import { logger } from './logger.ts';
import { parseConventionalCommit } from './parser.ts';

interface CommitHeader {
	hash: string;
	author: string;
	email: string;
	date: string;
	subject: string;
	body: string;
}
type Join<T extends ReadonlyArray<string>, S extends string = ''>
	= T extends Readonly<[infer First, ...infer Rest]>
	? Rest extends ReadonlyArray<string>
	? First extends string
	? `${First}${Rest extends [] ? '' : S}${Join<Rest, S>}`
	: never
	: never
	: '';
/**
 * Commit header regex with pipe delimiter
 */
const sR = [
	'(?<hash>[a-f0-9]{7,})' as const,
	'(?<author>[^|]+)' as const,
	'(?<email>[^|]+)' as const,
	'(?<date>[^|]+)' as const,
	'(?<subject>[^|]+)' as const,
	'(?<body>.*)' as const,
] as const;
const commitHeaderRegex = regex(`^${sR.join('\\|') as Join<typeof sR>}$`);

/**
 * Maps a file path to a package name by finding the longest matching package path
 */
function mapFileToPackage(filePath: string, packages: PackageInfo[], root: string): string | undefined {
	logger.trace('Mapping file to package', { filePath });
	const normalizeForComparison = (value: string): string => value.replaceAll('\\', '/');

	// Normalize file path - git outputs relative paths from repo root
	const normalizedPath = normalizeForComparison(filePath.startsWith('./') ? filePath.slice(2) : filePath);

	// Find packages that match this file path
	// Compare using relative paths from root
	const matchingPackages = packages
		.filter((pkg) => {
			const packageRelativePath = normalizeForComparison(relative(root, pkg.path));

			// Check if file path starts with package path
			return normalizedPath.startsWith(`${packageRelativePath}/`)
				|| normalizedPath === packageRelativePath
		})
		.sort((a, b) => {
			// Sort by longest path first (most specific match)
			const pathA = a.path;
			const pathB = b.path;
			return pathB.length - pathA.length;
		});

	const packageName = matchingPackages.length > 0 ? matchingPackages[0].name : undefined;
	if (typeof packageName === 'string') {
		logger.trace('File mapped to package', { filePath, package: packageName });
	}
	else {
		logger.trace('File not mapped to any package', { filePath });
	}
	return packageName;
}

export type ParsedLine = { type: 'commit'; header: CommitHeader } | { type: 'file'; path: string };
/**
 * Processes a line and returns commit header if it's a commit line, or file path if it's a file line
 */
function parseLine(line: string): ParsedLine | null {
	const trimmed = line.trim();
	if (trimmed.length === 0) {
		return null;
	}

	// Check if it's a commit header (contains pipe delimiter)
	const headerMatch = commitHeaderRegex.exec(trimmed);
	if (headerMatch !== null && headerMatch.groups !== undefined) {
		return {
			type: 'commit',
			header: {
				...headerMatch.groups,
				body: headerMatch.groups.body?.trim() ?? '',
			},
		};
	}

	// Otherwise it's a file path
	return {
		type: 'file',
		path: trimmed,
	};
}

/**
 * Streams git log output and processes it in chunks, mapping files to packages
 */
export async function* streamGitCommits(
	gitProcess: { stdout: NodeJS.ReadableStream },
	packages: PackageInfo[],
	root: string = cwd(),
): AsyncGenerator<ParsedCommit, void, unknown> {
	logger.debug('Starting git commit streaming', { packageCount: packages.length, root });
	let buffer = '';
	let currentCommit: Partial<ParsedCommit> | undefined;
	const touchedPackages = new Set<string>();
	let commitCount = 0;
	const debugYieldedCommits: ParsedCommit[] = [];
	function finishCommit() {
		if (typeof currentCommit !== 'undefined' && currentCommit.hash !== undefined) {
			const packagesArray = Array.from(touchedPackages).sort();
			commitCount++;
			logger.trace('Yielding commit', { hash: currentCommit.hash?.slice(0, 7), packages: packagesArray });
			const commit = {
				...currentCommit,
				packages: packagesArray.length > 0 ? packagesArray : undefined,
			} as ParsedCommit;
			currentCommit = undefined;
			touchedPackages.clear();
			debugYieldedCommits.push(commit);
			return commit;
		}
	}

	for await (const chunk of gitProcess.stdout) {
		const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
		buffer += chunkStr;

		// Process complete lines
		const lines: ParsedLine[] = [];
		let newlineIndex = buffer.indexOf('\n');
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);
			newlineIndex = buffer.indexOf('\n');
			const parsed = parseLine(line);
			if (parsed !== null) {
				lines.push(parsed);
			}
		}
		for (const parsed of lines) {
			if (parsed.type === 'commit') {
				// Finish previous commit if any
				const previousCommit = finishCommit();
				if (previousCommit !== undefined) {
					yield previousCommit;
				}

				// Start new commit
				const { header } = parsed;
				logger.trace('Parsing new commit', { hash: header.hash.slice(0, 7), subject: header.subject });
				const parsedConventional = parseConventionalCommit(header.subject);

				currentCommit = {
					hash: header.hash,
					message: header.subject,
					body: header.body || undefined,
					author: `${header.author} <${header.email}>`,
					date: header.date,
					type: parsedConventional.type,
					scope: parsedConventional.scope,
					subject: parsedConventional.subject,
					breaking: parsedConventional.breaking,
				};
			}
			else if (parsed.type === 'file') {
				// Map file to package
				if (typeof currentCommit !== 'undefined') {
					const packageName = mapFileToPackage(parsed.path, packages, root);
					if (typeof packageName === 'string') {
						touchedPackages.add(packageName);
					}
				}
			}
		}
	}

	// Process any remaining data in buffer
	if (buffer.trim().length > 0) {
		const parsed = parseLine(buffer.trim());
		if (parsed !== null) {
			if (parsed.type === 'commit') {
				// Finish previous commit if any
				const previousCommit = finishCommit();
				if (previousCommit !== undefined) {
					yield previousCommit;
				}

				// Start new commit
				const { header } = parsed;
				logger.trace('Parsing new commit', { hash: header.hash.slice(0, 7), subject: header.subject });
				const parsedConventional = parseConventionalCommit(header.subject);

				currentCommit = {
					hash: header.hash,
					message: header.subject,
					body: header.body || undefined,
					author: `${header.author} <${header.email}>`,
					date: header.date,
					type: parsedConventional.type,
					scope: parsedConventional.scope,
					subject: parsedConventional.subject,
					breaking: parsedConventional.breaking,
				};
			}
			else if (parsed.type === 'file' && typeof currentCommit !== 'undefined') {
				const packageName = mapFileToPackage(parsed.path, packages, root);
				if (typeof packageName === 'string') {
					touchedPackages.add(packageName);
				}
			}
		}
	}

	// Yield final commit if any
	const finalCommit = finishCommit();
	if (finalCommit !== undefined) {
		yield finalCommit;
	}
	logger.debug('Finished streaming commits', { totalCommits: commitCount });
}
