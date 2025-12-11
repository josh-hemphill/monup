/**
 * Logger for @monup/changelog package
 */
import type { Logger } from 'loglevel';
import loglevel from 'loglevel';
import packageJson from '../jsr.json' with { type: 'json' };

export const logger: Logger = loglevel.getLogger(packageJson.name);
