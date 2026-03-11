import type { LogLevel, ResolvedMonupOptions } from '@monup/options';
/**
 * CLI entry point for monup
 */
import { argv, exit } from 'node:process';
import { _VERSION as changelogVersion } from '@monup/changelog';
import { _VERSION as gitVersion } from '@monup/git';
import { _VERSION as githubVersion } from '@monup/github';
import { _VERSION as optionsVersion, resolveOptions } from '@monup/options';
import { _VERSION as releaseVersion } from '@monup/release';
import { applyLogFormatter, parseConfigOverrides, _VERSION as utilsVersion } from '@monup/utils';
import { _VERSION as versionVersion } from '@monup/version';
import { _VERSION as workspaceVersion } from '@monup/workspace';
import { cac } from 'cac';
import loglevel from 'loglevel';
import packageJson from '../package.json' with { type: 'json' };
import { clearCache, initCache } from './cache.ts';
import { handleAll } from './commands/all.ts';
import { handleChangelog } from './commands/changelog.ts';
import { handleGithub } from './commands/github.ts';
import { handleJsrPrepare } from './commands/jsr-prepare.ts';
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

	const defaultLevel = logLevelConfig.default;
	if (typeof defaultLevel === 'string') {
		loglevel.setDefaultLevel(defaultLevel);
	}
	const loggers = loglevel.getLoggers();
	const packageLevels = logLevelConfig.packages;
	for (const [name, logger] of Object.entries(loggers)) {
		applyLogFormatter(logger);
		const packageLevel = packageLevels?.[name] ?? defaultLevel;
		logger.setLevel(packageLevel);
	}
}

export async function main(): Promise<void> {
	// Initialize cache at CLI start
	initCache();

	let resolvedOptions: ResolvedMonupOptions;

	const cli = cac('monup');

	cli
		.option('--log-level <level>', 'Set default log level (trace|debug|info|warn|error|silent)')
		.option('--ci', 'Run in CI mode (non-interactive)')
		.option('-s, --set <path=value>', 'Override config option (e.g. git.push=false)');

	cli
		.command('version', 'Update package versions based on commits')
		.option('--major', 'Force major version bump')
		.option('--minor', 'Force minor version bump')
		.option('--patch', 'Force patch version bump')
		.action(async(options: Record<string, unknown>) => {
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
		.action(async() => {
			await handleChangelog(resolvedOptions);
		});

	cli
		.command('release', 'Publish packages to npm/JSR')
		.option('--dry-run', 'Only validate, do not publish')
		.action(async(options: Record<string, unknown>) => {
			const dryRun = Boolean(typeof options.dryRun === 'boolean' && options.dryRun);
			if (dryRun) {
				resolvedOptions.release.dryRun = true;
			}
			await handleRelease(resolvedOptions, dryRun);
		});

	cli
		.command('jsr-prepare', 'Prepare JSR package entries for tokenless CI publishing')
		.option('--github-owner <owner>', 'GitHub repository owner for all packages')
		.option('--github-name <name>', 'GitHub repository name for all packages')
		.option('--readme-source <source>', 'Common readme source (readme|jsdoc)')
		.option('--runtime-browser <compat>', 'Browser compatibility (supported|unsupported|unknown)')
		.option('--runtime-deno <compat>', 'Deno compatibility (supported|unsupported|unknown)')
		.option('--runtime-node <compat>', 'Node.js compatibility (supported|unsupported|unknown)')
		.option('--runtime-workerd <compat>', 'workerd compatibility (supported|unsupported|unknown)')
		.option('--runtime-bun <compat>', 'Bun compatibility (supported|unsupported|unknown)')
		.option('--infer-descriptions', 'Infer package descriptions from package.json or README.md')
		.action(async(options: Record<string, unknown>) => {
			await handleJsrPrepare(resolvedOptions, options);
		});

	cli
		.command('github', 'Create GitHub releases')
		.action(async() => {
			await handleGithub(resolvedOptions);
		});

	cli
		.command('all', 'Run complete workflow: version → changelog → release → github')
		.action(async() => {
			await handleAll(resolvedOptions);
		});

	const versionText = `\n${versions.join('\n')}\n`;
	cli.version(versionText);
	cli.help((helpSections: Array<{ body: string }>) => {
		const versionSection = helpSections.find((section: { body: string }) => section.body.includes(versionText));
		if (versionSection) {
			versionSection.body = `Version: ${versions[0]}`;
		}
	});

	try {
		// Parse CLI args without running the command
		const { options } = cli.parse(argv, { run: false });
		const autoDetect = typeof options.ci === 'boolean' ? !options.ci : true;
		const logLevel = typeof options.logLevel === 'string' && options.logLevel.length > 0 ? options.logLevel : undefined;

		// Parse --set overrides (can be string or array of strings)
		let configOverrides: Record<string, unknown> = {};
		if (typeof options.set !== 'undefined') {
			const setEntries = Array.isArray(options.set)
				? options.set as string[]
				: [options.set as string];
			configOverrides = parseConfigOverrides(setEntries);
		}

		resolvedOptions = await resolveOptions({
			ci: { autoDetect },
			logLevel: typeof logLevel === 'string' ? { default: logLevel as LogLevel } : undefined,
			...configOverrides,
		});
		configureLogLevels(resolvedOptions);

		// Run the command yourself
		// You only need `await` when your command action returns a Promise
		await cli.runMatchedCommand();
	}
	catch(error) {
		// Handle error here..
		console.error((error as Error).stack);
		// Clear cache at CLI end (though this may not execute if process exits)
		// Cache will be cleared on next CLI invocation via initCache
		clearCache();
		exit(1);
	}

	// Clear cache at CLI end (though this may not execute if process exits)
	// Cache will be cleared on next CLI invocation via initCache
	clearCache();
}
