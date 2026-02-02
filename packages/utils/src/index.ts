/**
 * Shared utilities for monup packages
 */
import packageJson from '../jsr.json' with { type: 'json' };

export { detectCI } from './ci.ts';
export { getErrorMessage } from './error-utils.ts';
export { parseJson, parseJsonc, stripJsoncComments } from './jsonc.ts';
export { applyLogFormatter } from './log-formatter.ts';
export { createLogger, logger } from './logger.ts';
export { coerceValue, deepMerge, mergeWithDefaults, parseConfigOverrides, setByPath } from './merge.ts';
export { extractPackageName } from './package-utils.ts';
export { sortVersionsDescending, VERSION_FIELD_REGEX } from './version-constants.ts';

export const _VERSION: string = packageJson.version;
