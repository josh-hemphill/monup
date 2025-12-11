/**
 * Shared utilities for monup packages
 */
import packageJson from '../jsr.json' with { type: 'json' };

export { detectCI } from './ci.ts';
export { applyLogFormatter } from './log-formatter.ts';
export { logger } from './logger.ts';
export { deepMerge, mergeWithDefaults } from './merge.ts';

export const _VERSION: string = packageJson.version;
