import type { LogLevel, ResolvedMonupOptions } from '@monup/options';
/**
 * CLI entry point for monup
 */
import { exit } from 'node:process';
import { _VERSION as changelogVersion } from '@monup/changelog';
import { _VERSION as gitVersion } from '@monup/git';
import { _VERSION as githubVersion } from '@monup/github';
import { _VERSION as optionsVersion, resolveOptions } from '@monup/options';
import { _VERSION as releaseVersion } from '@monup/release';
import { applyLogFormatter, _VERSION as utilsVersion } from '@monup/utils';
import { _VERSION as versionVersion } from '@monup/version';
import { _VERSION as workspaceVersion } from '@monup/workspace';
import { cac } from 'cac';
import loglevel from 'loglevel';
import packageJson from '../jsr.json' with { type: 'json' };
import { handleAll } from './commands/all.ts';
import { handleChangelog } from './commands/changelog.ts';
import { handleGithub } from './commands/github.ts';
import { handleRelease } from './commands/release.ts';
import { handleVersion } from './commands/version.ts';

const versions = [
	`@monup/cli:${packageJson.version}`,
	`@monup/git:${gitVersion}`,
	`@monup/changelog:${changelogVersion}`,
	`@monup/github:${githubVersion}`,
	`@monup/release:${releaseVersion}`,
	`@monup/version:${versionVersion}`,
	`@monup/workspace:${workspaceVersion}`,
	`@monup/options:${optionsVersion}`,
	`@monup/utils:${utilsVersion}`,
];

/**
 * Configures log levels for all packages based on resolved options
 * Also applies the log formatter to all loggers
 */
function configureLogLevels(options: ResolvedMonupOptions): void {
	const logLevelConfig = options.logLevel;
	if (typeof logLevelConfig === 'undefined') {
		return;
	}

	// Apply formatter to default logger
	applyLogFormatter(loglevel);

	const defaultLevel = logLevelConfig.default;
	if (typeof defaultLevel === 'string') {
		loglevel.setLevel(defaultLevel);
	}

	const packageLevels = logLevelConfig.packages;
	if (typeof packageLevels === 'object' && packageLevels !== null) {
		for (const [packageName, level] of Object.entries(packageLevels)) {
			if (typeof level === 'string') {
				const logger = loglevel.getLogger(packageName);
				applyLogFormatter(logger);
				logger.setLevel(level);
			}
		}
	}
}

export function main(): void {
	const cli = cac('monup');

	cli
		.option('--log-level <level>', 'Set default log level (trace|debug|info|warn|error|silent)')
		.option('--ci', 'Run in CI mode (non-interactive)');

	cli
		.command('version', 'Update package versions based on commits')
		.option('--major', 'Force major version bump')
		.option('--minor', 'Force minor version bump')
		.option('--patch', 'Force patch version bump')
		.action(async (options: Record<string, unknown>) => {
			const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
			const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;
			const resolvedOptions = await resolveOptions({
				ci: { autoDetect },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			})
				.catch((error) => {
					console.error(error);
					exit(1);
				});
			configureLogLevels(resolvedOptions);
			const bumpType = typeof options.major === 'boolean' && options.major
				? 'major'
				: typeof options.minor === 'boolean' && options.minor
					? 'minor'
					: typeof options.patch === 'boolean' && options.patch
						? 'patch'
						: undefined;
			await handleVersion(resolvedOptions, bumpType);
		});

	cli
		.command('changelog', 'Generate changelog from commits')
		.action(async (options: Record<string, unknown>) => {
			const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
			const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;
			const resolvedOptions = await resolveOptions({
				ci: { autoDetect },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			});
			configureLogLevels(resolvedOptions);
			await handleChangelog(resolvedOptions);
		});

	cli
		.command('release', 'Publish packages to npm/JSR')
		.option('--dry-run', 'Only validate, do not publish')
		.action(async (options: Record<string, unknown>) => {
			const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
			const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;
			const baseOptions = await resolveOptions({
				ci: { autoDetect },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			});
			const dryRun = typeof options.dryRun === 'boolean' ? options.dryRun : baseOptions.release.dryRun;
			const resolvedOptions = await resolveOptions({
				ci: { autoDetect },
				release: { dryRun },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			});
			configureLogLevels(resolvedOptions);
			await handleRelease(resolvedOptions, typeof options.dryRun === 'boolean' ? options.dryRun : undefined);
		});

	cli
		.command('github', 'Create GitHub releases')
		.action(async (options: Record<string, unknown>) => {
			const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
			const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;
			const resolvedOptions = await resolveOptions({
				ci: { autoDetect },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			});
			configureLogLevels(resolvedOptions);
			await handleGithub(resolvedOptions);
		});

	cli
		.command('all', 'Run complete workflow: version → changelog → release → github')
		.action(async (options: Record<string, unknown>) => {
			const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
			const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;
			const resolvedOptions = await resolveOptions({
				ci: { autoDetect },
				logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			});
			configureLogLevels(resolvedOptions);
			await handleAll(resolvedOptions);
		});

	cli.help();
	cli.version(`\n${versions.join('\n')}\n`);

	cli.parse();
}
