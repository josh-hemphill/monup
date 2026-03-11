/**
 * Logger for @monup/changelog package
 */
import type { Logger } from 'loglevel';
import { createLogger } from '@monup/utils';
import packageJson from '../package.json' with { type: 'json' };

export const logger: Logger = createLogger(packageJson.name);
