/**
 * Git operations: commit, push, tag with signing support
 */
import { normalizePathForComparison } from '@monup/utils';
import { logger } from './logger.ts';
import { spawnGit } from './spawn.ts';

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
export async function pushToRemote(branch?: string, remote = 'origin'): Promise<void> {
	logger.debug('Pushing to remote', { branch, remote });
	const args = ['push', remote];

	if (typeof branch === 'string') {
		args.push(branch);
		logger.trace('Pushing specific branch', { branch });
	}

	await spawnGit(args, { stdio: 'inherit' });
	logger.debug('Push completed successfully');
}

/**
 * Creates a git tag with optional signing
 */
export async function createTag(
	tagName: string,
	message?: string,
	sign = false,
): Promise<void> {
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

	await spawnGit(args, { stdio: 'inherit' });
	logger.debug('Tag created successfully', { tagName });
}

/**
 * Formats a tag name using a template
 * Supports %s placeholder for version
 */
export function formatTag(template: string, version: string): string {
	return template.replace(/%s/g, version);
}
