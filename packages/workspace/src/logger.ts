/**
 * Logger for @monup/workspace package
 */
import loglevel from 'loglevel';
import packageJson from '../jsr.json' with { type: 'json' };

export const logger = loglevel.getLogger(packageJson.name);
