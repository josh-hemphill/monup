/**
 * Logger for @monup/cli package
 */
import type { Logger } from 'loglevel';
import { createLogger } from '@monup/utils';
import packageJson from '../jsr.json' with { type: 'json' };

export const logger: Logger = createLogger(packageJson.name);
