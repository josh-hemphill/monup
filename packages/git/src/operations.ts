/**
 * Git operations: commit, push, tag with signing support
 */
import { cwd } from 'node:process';
import { normalizePathForComparison } from '@monup/utils';
import { logger } from './logger.ts';
import { spawnGit } from './spawn.ts';

const LINE_SPLIT_PATTERN = /\r?\n/;
const TEMPLATE_PLACEHOLDER_PATTERN = /%s/g;

/**
 * Creates a git commit with optional signing
 */
export async function createCommit(
	message: string,
	files: string[],
	sign = false,
	noVerify = false,
	cwd?: string,
): Promise<void> {
	const normalizedFiles = files.map((filePath) => normalizePathForComparison(filePath));
	logger.debug('Creating git commit', { message, files: normalizedFiles.length, sign, noVerify });
	const args = ['commit'];

	if (sign) {
		args.push('-S');
		logger.trace('Commit signing enabled');
	}

	if (noVerify) {
		args.push('--no-verify');
		logger.trace('Hooks verification disabled');
	}

	args.push('-m', message);

	if (normalizedFiles.length > 0) {
		args.push('--', ...normalizedFiles);
		logger.trace('Files to commit', { files: normalizedFiles });
	}

	await spawnGit(args, { cwd, stdio: 'inherit' });
	logger.debug('Commit created successfully');
}

/**
 * Pushes commits to remote
 */
export async function pushToRemote(branch?: string, remote = 'origin', cwd?: string): Promise<void> {
	logger.debug('Pushing to remote', { branch, remote });
	const args = ['push', remote];

	if (typeof branch === 'string') {
		args.push(branch);
		logger.trace('Pushing specific branch', { branch });
	}

	await spawnGit(args, { cwd, stdio: 'inherit' });
	logger.debug('Push completed successfully');
}

export interface WorkingTreeChange {
	indexStatus: string;
	workingTreeStatus: string;
	path: string;
	raw: string;
}

export interface WorkingTreeStatus {
	branch?: string;
	changes: WorkingTreeChange[];
	isClean: boolean;
}

/** Parses a porcelain git status line into structured change data. */
function parseWorkingTreeChange(line: string): WorkingTreeChange {
	const statusCode = line.slice(0, 2);
	const path = line.slice(3).trim();
	return {
		indexStatus: statusCode[0] ?? ' ',
		workingTreeStatus: statusCode[1] ?? ' ',
		path,
		raw: line,
	};
}

/** Gets the current working tree status for diagnostics and validation. */
export async function getWorkingTreeStatus(root: string = cwd()): Promise<WorkingTreeStatus> {
	const { stdout } = await spawnGit(
		['status', '--porcelain=v1', '--branch', '--untracked-files=all'],
		{ cwd: root, stdio: 'pipe' },
	);
	const lines = stdout.split(LINE_SPLIT_PATTERN).filter((line) => line.length > 0);
	let branch: string | undefined;

	if (lines[0]?.startsWith('## ')) {
		branch = lines.shift()?.slice(3).trim();
	}

	const changes = lines.map(parseWorkingTreeChange);
	logger.debug('Collected git working tree status', {
		root,
		branch,
		changeCount: changes.length,
	});
	return {
		branch,
		changes,
		isClean: changes.length === 0,
	};
}

/** Throws when the git working tree contains tracked or untracked changes. */
export async function assertCleanWorkingTree(root: string = cwd()): Promise<void> {
	const workingTreeStatus = await getWorkingTreeStatus(root);
	if (workingTreeStatus.isClean) {
		return;
	}

	logger.error('Git working tree is not clean', {
		root,
		branch: workingTreeStatus.branch,
		changeCount: workingTreeStatus.changes.length,
		changes: workingTreeStatus.changes.map((change) => change.raw),
	});

	const preview = workingTreeStatus.changes
		.slice(0, 10)
		.map((change) => change.raw)
		.join(', ');
	const suffix = workingTreeStatus.changes.length > 10 ? ', ...' : '';
	throw new Error(`Git working tree is not clean: ${preview}${suffix}`);
}

/** Returns true if the given tag ref exists. */
async function tagExists(tagName: string, cwd?: string): Promise<boolean> {
	try {
		await spawnGit(['rev-parse', '--verify', tagName], { cwd, stdio: 'pipe' });
		return true;
	}
	catch {
		return false;
	}
}

/**
 * Creates a git tag with optional signing
 * Skips creation if the tag already exists (idempotent).
 */
export async function createTag(
	tagName: string,
	message?: string,
	sign = false,
	cwd?: string,
): Promise<void> {
	const exists = await tagExists(tagName, cwd);
	if (exists) {
		logger.debug('Tag already exists, skipping creation', { tagName });
		return;
	}
	logger.debug('Creating git tag', { tagName, hasMessage: typeof message === 'string', sign });
	const args = ['tag'];

	if (sign) {
		args.push('-s');
		logger.trace('Tag signing enabled');
	}

	if (typeof message === 'string') {
		args.push('-m', message);
		logger.trace('Tag message provided');
	}

	args.push(tagName);

	await spawnGit(args, { cwd, stdio: 'inherit' });
	logger.debug('Tag created successfully', { tagName });
}

/**
 * Formats a tag name using a template
 * Supports %s placeholder for version
 */
export function formatTag(template: string, version: string): string {
	return template.replace(TEMPLATE_PLACEHOLDER_PATTERN, version);
}
