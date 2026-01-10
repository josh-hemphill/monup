/**
 * GitHub API client and release creation
 */
import packageJson from '../jsr.json' with { type: 'json' };

export { extractChangelogForRelease } from './extractor.ts';
export { logger } from './logger.ts';
export type { GitHubOptions, GitHubOptionsWithDeps } from './options.ts';
export { defaultGitHubOptions } from './options.ts';
export type { GitHubRelease } from './release.ts';
export { createRelease, listReleases } from './release.ts';
export const _VERSION: string = packageJson.version;
