import type { ResolvedMonupOptions } from '@monup/options';
import type {
	JsrAuthorizationResult,
	JsrGitHubRepository,
	JsrPackageSettings,
	JsrReadmeSource,
	JsrRuntimeCompat,
	JsrSetupOptions,
} from '@monup/release';
import type { PackageInfo } from '@monup/workspace';
/**
 * JSR prepare command handler.
 */
import { stdin, stdout } from 'node:process';
import { cancel as clackCancel, confirm as clackConfirm, isCancel, note as clackNote, select as clackSelect, spinner as clackSpinner, text as clackText } from '@clack/prompts';
import { createJsrAuthorization, pollJsrAuthorization, resolveJsrSetupToken, setupJsrPackages } from '@monup/release';
import { openExternalUrl, parseJson } from '@monup/utils';
import { fs, path } from 'zx';
import { logger } from '../logger.ts';
import { getPackagesWithCache } from '../package-utils.ts';

const RUNTIME_COMPAT_KEYS = ['browser', 'deno', 'node', 'workerd', 'bun'] as const;

type RuntimeCompatKey = typeof RUNTIME_COMPAT_KEYS[number];
type RuntimeCompatOptionValue = boolean | null | undefined;

interface JsrWorkspacePackage {
	packageInfo: PackageInfo;
	packageName: string;
	jsrManifestPath: string;
}

interface SelectChoice<T extends string> {
	value: T;
	label: string;
	hint?: string;
}

export interface JsrPrepareCommandOptions {
	githubOwner?: unknown;
	githubName?: unknown;
	readmeSource?: unknown;
	runtimeBrowser?: unknown;
	runtimeDeno?: unknown;
	runtimeNode?: unknown;
	runtimeWorkerd?: unknown;
	runtimeBun?: unknown;
	inferDescriptions?: unknown;
}

export interface PromptSession {
	promptText: (message: string, defaultValue?: string) => Promise<string>;
	confirm: (message: string, initialValue?: boolean) => Promise<boolean>;
	select: <T extends string>(message: string, options: SelectChoice<T>[], initialValue: T) => Promise<T>;
	close: () => void;
}

/**
 * Resolves shared and per-package JSR prepare input.
 */
export async function resolveJsrPrepareInput(
	options: ResolvedMonupOptions,
	packages: PackageInfo[],
	commandOptions: JsrPrepareCommandOptions,
	promptSession?: PromptSession,
): Promise<JsrSetupOptions> {
	const jsrPackages = await getJsrWorkspacePackages(packages);
	const sharedSettings = await resolveSharedSettings(options, commandOptions, promptSession);
	const packageOverrides = await createInitialPackageOverrides(jsrPackages, commandOptions, promptSession);
	await maybeEditIndividualPackages(jsrPackages, sharedSettings, packageOverrides, promptSession);

	const normalizedOverrides = Object.fromEntries(
		Object.entries(packageOverrides)
			.map(([packageName, settings]) => [packageName, compactPackageSettings(settings)] as const)
			.filter((entry): entry is [string, JsrPackageSettings] => typeof entry[1] !== 'undefined'),
	);

	return {
		...sharedSettings,
		packageOverrides: Object.keys(normalizedOverrides).length > 0 ? normalizedOverrides : undefined,
	};
}

/**
 * Handles local JSR package preparation.
 */
export async function handleJsrPrepare(
	options: ResolvedMonupOptions,
	commandOptions: JsrPrepareCommandOptions = {},
	promptSession?: PromptSession,
): Promise<void> {
	const packages = await getPackagesWithCache();
	if (typeof packages === 'undefined') {
		return;
	}

	const jsrPackages = await getJsrWorkspacePackages(packages);
	if (jsrPackages.length === 0) {
		logger.warn('No JSR packages found in workspace');
		return;
	}

	const interactiveSession = promptSession ?? createPromptSession();
	const shouldCloseSession = typeof promptSession === 'undefined' && typeof interactiveSession !== 'undefined';
	try {
		const token = await resolveJsrPrepareToken(interactiveSession, typeof promptSession === 'undefined');
		const setupOptions = await resolveJsrPrepareInput(options, packages, commandOptions, interactiveSession);
		logger.info('Preparing JSR package entries', { packageCount: jsrPackages.length });

		const results = await setupJsrPackages(packages, {
			...setupOptions,
			token,
		});
		const createdCount = results.filter((result) => result.created).length;
		const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
		const updatedCount = results.reduce((total, result) => total + result.updatedFields.length, 0);

		logger.info('JSR package preparation complete', {
			packageCount: results.length,
			createdCount,
			updatedCount,
			warningCount,
		});
	}
	finally {
		if (shouldCloseSession) {
			interactiveSession?.close();
		}
	}
}

/**
 * Resolves the JSR token using interactive auth by default when available.
 */
export async function resolveJsrPrepareToken(
	promptSession?: PromptSession,
	useTerminalUi = false,
): Promise<string> {
	if (typeof promptSession === 'undefined') {
		const token = resolveJsrSetupToken();
		if (typeof token !== 'string') {
			throw new Error('JSR setup requires the JSR_TOKEN environment variable.');
		}

		return token;
	}

	const session = await createJsrAuthorization();
	const browserOpened = await openExternalUrl(session.verificationUrl);
	if (browserOpened) {
		logger.info('Opened JSR authorization URL in the default browser');
	}
	else {
		logger.warn('Unable to open the browser automatically. Continue with the URL and code shown below.');
	}

	showAuthorizationInstructions(session, useTerminalUi);
	return waitForAuthorization(session, useTerminalUi);
}

/**
 * Creates a clack-based prompt session when stdin/stdout are interactive.
 */
function createPromptSession(): PromptSession | undefined {
	if (!(stdin.isTTY && stdout.isTTY)) {
		return undefined;
	}

	return {
		async promptText(message: string, defaultValue?: string): Promise<string> {
			const answer = await clackText({
				message,
				initialValue: defaultValue,
			});
			return unwrapPromptResult(answer, 'JSR prepare cancelled.');
		},
		async confirm(message: string, initialValue = false): Promise<boolean> {
			const answer = await clackConfirm({
				message,
				initialValue,
			});
			return unwrapPromptResult(answer, 'JSR prepare cancelled.');
		},
		async select<T extends string>(message: string, options: SelectChoice<T>[], initialValue: T): Promise<T> {
			const normalizedOptions = options.map((option) => ({ ...option }));
			const answer = await clackSelect({
				message,
				options: normalizedOptions as never,
				initialValue,
			});
			return unwrapPromptResult(answer, 'JSR prepare cancelled.');
		},
		close(): void {
			// Clack manages its own lifecycle, so there is nothing to close here.
		},
	};
}

/**
 * Unwraps a clack prompt result or throws on cancellation.
 */
function unwrapPromptResult<T>(value: T | symbol, cancelMessage: string): T {
	if (isCancel(value)) {
		clackCancel(cancelMessage);
		throw new Error(cancelMessage);
	}

	return value;
}

/**
 * Shows the user the verification URL and fallback code.
 */
function showAuthorizationInstructions(session: { verificationUrl: string; code: string }, useTerminalUi: boolean): void {
	const message = [
		'Approve Monup in JSR using the browser window that was opened.',
		'Enter this code in the JSR page:',
		'',
		session.code,
		'',
		`Verification URL: ${session.verificationUrl}`,
	].join('\n');

	if (useTerminalUi) {
		clackNote(message, 'JSR Authorization');
		return;
	}

	logger.info(message);
}

/**
 * Polls the JSR authorization flow until approval succeeds.
 */
async function waitForAuthorization(
	session: Parameters<typeof pollJsrAuthorization>[0],
	useTerminalUi: boolean,
): Promise<string> {
	const spinner = useTerminalUi ? clackSpinner() : undefined;
	spinner?.start('Waiting for JSR authorization approval...');

	try {
		const result = await pollJsrAuthorization(session, {
			onPending: async(attempt: number) => {
				logger.debug('Waiting for JSR authorization approval', { attempt });
			},
		});
		finishAuthorizationSpinner(spinner, result);
		return result.token;
	}
	catch (error: unknown) {
		spinner?.stop('JSR authorization failed.');
		logger.error('JSR authorization failed. Re-run with --log-level debug for more details.', {
			message: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Finishes the terminal spinner after auth approval.
 */
function finishAuthorizationSpinner(
	spinner: ReturnType<typeof clackSpinner> | undefined,
	result: JsrAuthorizationResult,
): void {
	const approvedAs = typeof result.user.name === 'string' && result.user.name.length > 0
		? result.user.name
		: result.user.id;
	spinner?.stop(`JSR authorization approved for ${approvedAs}.`);
}

/**
 * Resolves shared settings from flags, config defaults, and prompts.
 */
async function resolveSharedSettings(
	options: ResolvedMonupOptions,
	commandOptions: JsrPrepareCommandOptions,
	promptSession?: PromptSession,
): Promise<JsrPackageSettings> {
	const defaultRepository = parseGitHubRepository(options.github.repo);
	const githubOwner = await resolveRequiredTextInput(
		getTrimmedString(commandOptions.githubOwner) ?? defaultRepository?.owner,
		'GitHub owner',
		promptSession,
	);
	const githubName = await resolveRequiredTextInput(
		getTrimmedString(commandOptions.githubName) ?? defaultRepository?.name,
		'GitHub repository name',
		promptSession,
	);
	const readmeSource = await resolveReadmeSource(commandOptions.readmeSource, promptSession);
	const runtimeCompat = await resolveRuntimeCompat(commandOptions, promptSession);

	return compactPackageSettings({
		githubRepository: {
			owner: githubOwner,
			name: githubName,
		},
		readmeSource,
		runtimeCompat,
	}) ?? {};
}

/**
 * Creates initial package overrides, including inferred descriptions.
 */
async function createInitialPackageOverrides(
	packages: JsrWorkspacePackage[],
	commandOptions: JsrPrepareCommandOptions,
	promptSession?: PromptSession,
): Promise<Record<string, JsrPackageSettings>> {
	const shouldInfer = await resolveInferDescriptions(commandOptions.inferDescriptions, promptSession);
	if (!shouldInfer) {
		return {};
	}

	const overrides: Record<string, JsrPackageSettings> = {};
	for (const pkg of packages) {
		const description = await inferPackageDescription(pkg.packageInfo);
		if (typeof description === 'string') {
			overrides[pkg.packageName] = { description };
		}
	}

	return overrides;
}

/**
 * Offers package-by-package override editing on top of shared defaults.
 */
async function maybeEditIndividualPackages(
	packages: JsrWorkspacePackage[],
	sharedSettings: JsrPackageSettings,
	packageOverrides: Record<string, JsrPackageSettings>,
	promptSession?: PromptSession,
): Promise<void> {
	if (typeof promptSession === 'undefined') {
		return;
	}

	const shouldReviewPackages = await promptSession.confirm('Review individual JSR packages?', false);
	if (!shouldReviewPackages) {
		return;
	}

	for (const pkg of packages) {
		const shouldEditPackage = await promptSession.confirm(`Customize ${pkg.packageName}?`, false);
		if (!shouldEditPackage) {
			continue;
		}

		const currentSettings = {
			...sharedSettings,
			...(packageOverrides[pkg.packageName] ?? {}),
			runtimeCompat: {
				...(sharedSettings.runtimeCompat ?? {}),
				...(packageOverrides[pkg.packageName]?.runtimeCompat ?? {}),
			},
		};
		const updatedSettings = await resolvePackageOverride(pkg, sharedSettings, currentSettings, promptSession);
		const mergedSettings = compactPackageSettings({
			...(packageOverrides[pkg.packageName] ?? {}),
			...updatedSettings,
			runtimeCompat: typeof updatedSettings.runtimeCompat === 'undefined'
				? packageOverrides[pkg.packageName]?.runtimeCompat
				: updatedSettings.runtimeCompat,
		});
		if (typeof mergedSettings === 'undefined') {
			delete packageOverrides[pkg.packageName];
			continue;
		}

		packageOverrides[pkg.packageName] = mergedSettings;
	}
}

/**
 * Resolves overrides for one package using the current gathered defaults.
 */
async function resolvePackageOverride(
	pkg: JsrWorkspacePackage,
	sharedSettings: JsrPackageSettings,
	currentSettings: JsrPackageSettings,
	promptSession: PromptSession,
): Promise<JsrPackageSettings> {
	const description = await promptSession.promptText(
		`Description for ${pkg.packageName}`,
		currentSettings.description,
	);
	const githubOwner = await promptSession.promptText(
		`GitHub owner for ${pkg.packageName}`,
		currentSettings.githubRepository?.owner,
	);
	const githubName = await promptSession.promptText(
		`GitHub repository name for ${pkg.packageName}`,
		currentSettings.githubRepository?.name,
	);
	const readmeSource = await promptSession.select(
		`Readme source for ${pkg.packageName}`,
		[
			{ value: 'shared', label: 'Use shared/default value' },
			{ value: 'readme', label: 'Use README.md' },
			{ value: 'jsdoc', label: 'Use JSDoc' },
			{ value: 'skip', label: 'Do not set a package-specific value' },
		],
		currentSettings.readmeSource ?? 'shared',
	);

	let runtimeCompat: JsrRuntimeCompat | undefined;
	const shouldCustomizeRuntimeCompat = await promptSession.confirm(
		`Customize runtime compatibility for ${pkg.packageName}?`,
		false,
	);
	if (shouldCustomizeRuntimeCompat) {
		runtimeCompat = {};
		for (const runtimeKey of RUNTIME_COMPAT_KEYS) {
			const currentValue = currentSettings.runtimeCompat?.[runtimeKey];
			const selectedValue = await promptSession.select(
				`${runtimeKey} compatibility for ${pkg.packageName}`,
				[
					{ value: 'shared', label: 'Use shared/default value' },
					{ value: 'supported', label: 'Supported' },
					{ value: 'unsupported', label: 'Unsupported' },
					{ value: 'unknown', label: 'Unknown' },
				],
				runtimeCompatValueToChoice(currentValue),
			);
			const parsedValue = parseRuntimeCompatChoice(selectedValue);
			if (typeof parsedValue === 'boolean' || parsedValue === null) {
				runtimeCompat[runtimeKey] = parsedValue;
			}
		}
	}

	const resolvedSettings = compactPackageSettings({
		description: description.trim().length > 0 ? description.trim() : undefined,
		githubRepository: githubOwner.trim().length > 0 && githubName.trim().length > 0
			? {
					owner: githubOwner.trim(),
					name: githubName.trim(),
				}
			: undefined,
		readmeSource: parsePackageReadmeSourceChoice(readmeSource),
		runtimeCompat,
	}) ?? {};

	return createPackageSpecificSettings(sharedSettings, resolvedSettings);
}

/**
 * Resolves whether descriptions should be inferred automatically.
 */
async function resolveInferDescriptions(
	rawValue: unknown,
	promptSession?: PromptSession,
): Promise<boolean> {
	if (typeof rawValue === 'boolean') {
		return rawValue;
	}

	if (typeof promptSession === 'undefined') {
		return false;
	}

	return promptSession.confirm(
		'Infer per-package descriptions from package.json or README.md when available?',
		true,
	);
}

/**
 * Returns only packages that have a JSR manifest and reads their JSR package names.
 */
async function getJsrWorkspacePackages(packages: PackageInfo[]): Promise<JsrWorkspacePackage[]> {
	const result: JsrWorkspacePackage[] = [];
	const seen = new Set<string>();

	for (const pkg of packages) {
		const jsrManifestPath = getJsrManifestPath(pkg);
		if (typeof jsrManifestPath !== 'string') {
			continue;
		}

		const packageName = await readJsrPackageName(jsrManifestPath);
		if (seen.has(packageName)) {
			continue;
		}

		result.push({
			packageInfo: pkg,
			packageName,
			jsrManifestPath,
		});
		seen.add(packageName);
	}

	return result;
}

/**
 * Finds the JSR manifest path for a logical package.
 */
function getJsrManifestPath(pkg: PackageInfo): string | undefined {
	const manifestPaths = pkg.packageFiles ?? (typeof pkg.packageFile === 'string' ? [pkg.packageFile] : []);
	return manifestPaths.find((manifestPath) => manifestPath.endsWith('jsr.json') || manifestPath.endsWith('jsr.jsonc'));
}

/**
 * Reads a JSR package name from its manifest.
 */
async function readJsrPackageName(jsrManifestPath: string): Promise<string> {
	const raw = await fs.readFile(jsrManifestPath, 'utf-8');
	const manifest = parseJson<{ name?: unknown }>(raw);
	if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
		throw new Error(`JSR manifest is missing a package name: ${jsrManifestPath}`);
	}

	return manifest.name.trim();
}

/**
 * Infers a package description from package.json first, then README content.
 */
export async function inferPackageDescription(pkg: PackageInfo): Promise<string | undefined> {
	const packageJsonDescription = await readPackageJsonDescription(pkg.path);
	if (typeof packageJsonDescription === 'string') {
		return packageJsonDescription;
	}

	return readReadmeDescription(pkg.path);
}

/**
 * Reads a description from package.json when available.
 */
async function readPackageJsonDescription(packagePath: string): Promise<string | undefined> {
	const packageJsonPath = path.join(packagePath, 'package.json');
	if (!(await fs.exists(packageJsonPath))) {
		return undefined;
	}

	try {
		const raw = await fs.readFile(packageJsonPath, 'utf-8');
		const packageJson = parseJson<{ description?: unknown }>(raw);
		if (typeof packageJson.description !== 'string') {
			return undefined;
		}

		return normalizeDescription(packageJson.description);
	}
	catch {
		return undefined;
	}
}

/**
 * Reads the first meaningful paragraph from a README as a description guess.
 */
async function readReadmeDescription(packagePath: string): Promise<string | undefined> {
	const readmePath = path.join(packagePath, 'README.md');
	if (!(await fs.exists(readmePath))) {
		return undefined;
	}

	try {
		const raw = await fs.readFile(readmePath, 'utf-8');
		const paragraphs = extractReadmeParagraphs(raw);
		for (const paragraph of paragraphs) {
			const normalized = normalizeDescription(paragraph);
			if (typeof normalized === 'string') {
				return normalized;
			}
		}
	}
	catch {
		return undefined;
	}

	return undefined;
}

/**
 * Extracts non-heading README paragraphs, ignoring fenced code blocks.
 */
function extractReadmeParagraphs(markdown: string): string[] {
	const paragraphs: string[] = [];
	const currentLines: string[] = [];
	let inFence = false;

	const flushParagraph = (): void => {
		if (currentLines.length === 0) {
			return;
		}

		paragraphs.push(currentLines.join(' '));
		currentLines.length = 0;
	};

	for (const line of markdown.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed.startsWith('```')) {
			inFence = !inFence;
			flushParagraph();
			continue;
		}

		if (inFence) {
			continue;
		}

		if (trimmed.length === 0) {
			flushParagraph();
			continue;
		}

		if (
			trimmed.startsWith('#')
			|| trimmed.startsWith('>')
			|| trimmed.startsWith('![')
			|| trimmed.startsWith('- ')
			|| trimmed.startsWith('* ')
		) {
			flushParagraph();
			continue;
		}

		currentLines.push(trimmed);
	}

	flushParagraph();
	return paragraphs;
}

/**
 * Normalizes a description to plain text and JSR-safe length.
 */
function normalizeDescription(value: string): string | undefined {
	const normalized = value
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
	if (normalized.length === 0) {
		return undefined;
	}

	return normalized.length <= 250
		? normalized
		: `${normalized.slice(0, 247).trimEnd()}...`;
}

/**
 * Resolves a required string from defaults or prompts.
 */
async function resolveRequiredTextInput(
	initialValue: string | undefined,
	label: string,
	promptSession?: PromptSession,
): Promise<string> {
	if (typeof initialValue === 'string' && initialValue.length > 0) {
		return initialValue;
	}

	if (typeof promptSession === 'undefined') {
		throw new TypeError(`JSR prepare requires ${label}. Run interactively or pass the matching flag.`);
	}

	const value = (await promptSession.promptText(label)).trim();
	if (value.length === 0) {
		throw new Error(`JSR prepare requires ${label}.`);
	}

	return value;
}

/**
 * Resolves an optional readme source from CLI flags or prompts.
 */
async function resolveReadmeSource(
	rawValue: unknown,
	promptSession?: PromptSession,
): Promise<JsrReadmeSource | undefined> {
	const readmeSource = parseReadmeSource(rawValue);
	if (typeof readmeSource === 'string') {
		return readmeSource;
	}

	if (typeof promptSession === 'undefined') {
		return undefined;
	}

	const selectedValue = await promptSession.select(
		'Readme source for all packages',
		[
			{ value: 'skip', label: 'Do not set a shared value' },
			{ value: 'readme', label: 'Use README.md' },
			{ value: 'jsdoc', label: 'Use JSDoc' },
		],
		'skip',
	);

	return parseReadmeSource(selectedValue);
}

/**
 * Resolves optional runtime compatibility from flags and interactive prompts.
 */
async function resolveRuntimeCompat(
	commandOptions: JsrPrepareCommandOptions,
	promptSession?: PromptSession,
): Promise<JsrRuntimeCompat | undefined> {
	const runtimeCompat = parseRuntimeCompatFlags(commandOptions);
	if (typeof runtimeCompat !== 'undefined') {
		return runtimeCompat;
	}

	if (typeof promptSession === 'undefined') {
		return undefined;
	}

	const shouldConfigure = await promptSession.confirm('Configure shared runtime compatibility?', false);
	if (!shouldConfigure) {
		return undefined;
	}

	const resolved: JsrRuntimeCompat = {};
	for (const runtimeKey of RUNTIME_COMPAT_KEYS) {
		const selectedValue = await promptSession.select(
			`${runtimeKey} compatibility for all packages`,
			[
				{ value: 'supported', label: 'Supported' },
				{ value: 'unsupported', label: 'Unsupported' },
				{ value: 'unknown', label: 'Unknown' },
			],
			'unknown',
		);
		resolved[runtimeKey] = parseRuntimeCompatValue(selectedValue, `runtime-${runtimeKey}`) ?? null;
	}

	return resolved;
}

/**
 * Parses a GitHub repository string like owner/name.
 */
function parseGitHubRepository(rawRepository: string | undefined): JsrGitHubRepository | undefined {
	if (typeof rawRepository !== 'string') {
		return undefined;
	}

	const [owner, name, extra] = rawRepository.split('/');
	if (typeof owner !== 'string' || owner.length === 0 || typeof name !== 'string' || name.length === 0 || typeof extra === 'string') {
		return undefined;
	}

	return { owner, name };
}

/**
 * Parses an optional readme source value.
 */
function parseReadmeSource(rawValue: unknown): JsrReadmeSource | undefined {
	const value = getTrimmedString(rawValue)?.toLowerCase();
	if (typeof value === 'undefined' || value === 'skip' || value === 'none' || value === 'shared') {
		return undefined;
	}
	if (value === 'readme' || value === 'jsdoc') {
		return value;
	}

	throw new TypeError(`Invalid readme source: ${String(rawValue)}`);
}

/**
 * Converts package-level readme choice values into package-specific overrides.
 */
function parsePackageReadmeSourceChoice(choice: string): JsrReadmeSource | undefined {
	return parseReadmeSource(choice);
}

/**
 * Parses all runtime compatibility flags into one object.
 */
function parseRuntimeCompatFlags(commandOptions: JsrPrepareCommandOptions): JsrRuntimeCompat | undefined {
	const runtimeCompat: JsrRuntimeCompat = {};
	const runtimeValues: Array<[RuntimeCompatKey, RuntimeCompatOptionValue]> = [
		['browser', parseRuntimeCompatValue(commandOptions.runtimeBrowser, 'runtime-browser')],
		['deno', parseRuntimeCompatValue(commandOptions.runtimeDeno, 'runtime-deno')],
		['node', parseRuntimeCompatValue(commandOptions.runtimeNode, 'runtime-node')],
		['workerd', parseRuntimeCompatValue(commandOptions.runtimeWorkerd, 'runtime-workerd')],
		['bun', parseRuntimeCompatValue(commandOptions.runtimeBun, 'runtime-bun')],
	];

	for (const [key, value] of runtimeValues) {
		if (typeof value === 'boolean' || value === null) {
			runtimeCompat[key] = value;
		}
	}

	return Object.keys(runtimeCompat).length > 0 ? runtimeCompat : undefined;
}

/**
 * Parses a single runtime compatibility flag value.
 */
function parseRuntimeCompatValue(rawValue: unknown, optionName: string): RuntimeCompatOptionValue {
	const value = getTrimmedString(rawValue)?.toLowerCase();
	if (typeof value === 'undefined' || value === 'skip' || value === 'omit' || value === 'shared') {
		return undefined;
	}
	if (value === 'supported' || value === 'true' || value === 'yes' || value === 'y') {
		return true;
	}
	if (value === 'unsupported' || value === 'false' || value === 'no' || value === 'n') {
		return false;
	}
	if (value === 'unknown' || value === 'null') {
		return null;
	}

	throw new TypeError(`Invalid ${optionName} value: ${String(rawValue)}`);
}

/**
 * Converts runtime compatibility into a select choice.
 */
function runtimeCompatValueToChoice(value: boolean | null | undefined): 'shared' | 'supported' | 'unsupported' | 'unknown' {
	if (typeof value === 'undefined') {
		return 'shared';
	}
	if (value === true) {
		return 'supported';
	}
	if (value === false) {
		return 'unsupported';
	}
	return 'unknown';
}

/**
 * Converts a runtime compatibility choice into an override value.
 */
function parseRuntimeCompatChoice(choice: string): RuntimeCompatOptionValue {
	return parseRuntimeCompatValue(choice, 'runtime-compat-choice');
}

/**
 * Removes empty values from package settings.
 */
function compactPackageSettings(settings: JsrPackageSettings): JsrPackageSettings | undefined {
	const runtimeCompat = compactRuntimeCompat(settings.runtimeCompat);
	const description = normalizeDescription(settings.description ?? '');
	const githubRepository = typeof settings.githubRepository?.owner === 'string'
		&& settings.githubRepository.owner.length > 0
		&& typeof settings.githubRepository.name === 'string'
		&& settings.githubRepository.name.length > 0
		? settings.githubRepository
		: undefined;

	const compacted: JsrPackageSettings = {
		description,
		githubRepository,
		readmeSource: settings.readmeSource,
		runtimeCompat,
	};

	return Object.values(compacted).some((value) => typeof value !== 'undefined')
		? compacted
		: undefined;
}

/**
 * Keeps only package settings that differ from the shared defaults.
 */
function createPackageSpecificSettings(
	sharedSettings: JsrPackageSettings,
	settings: JsrPackageSettings,
): JsrPackageSettings {
	const runtimeCompat = createPackageSpecificRuntimeCompat(
		sharedSettings.runtimeCompat,
		settings.runtimeCompat,
	);

	return compactPackageSettings({
		description: settings.description !== sharedSettings.description ? settings.description : undefined,
		githubRepository: settings.githubRepository?.owner !== sharedSettings.githubRepository?.owner
			|| settings.githubRepository?.name !== sharedSettings.githubRepository?.name
			? settings.githubRepository
			: undefined,
		readmeSource: settings.readmeSource !== sharedSettings.readmeSource ? settings.readmeSource : undefined,
		runtimeCompat,
	}) ?? {};
}

/**
 * Keeps only runtime compatibility values that differ from shared defaults.
 */
function createPackageSpecificRuntimeCompat(
	sharedRuntimeCompat: JsrRuntimeCompat | undefined,
	runtimeCompat: JsrRuntimeCompat | undefined,
): JsrRuntimeCompat | undefined {
	if (typeof runtimeCompat === 'undefined') {
		return undefined;
	}

	const result: JsrRuntimeCompat = {};
	for (const key of RUNTIME_COMPAT_KEYS) {
		const currentValue = runtimeCompat[key];
		const sharedValue = sharedRuntimeCompat?.[key];
		if (currentValue !== sharedValue && (typeof currentValue === 'boolean' || currentValue === null)) {
			result[key] = currentValue;
		}
	}

	return compactRuntimeCompat(result);
}

/**
 * Removes undefined runtime compatibility fields.
 */
function compactRuntimeCompat(runtimeCompat: JsrRuntimeCompat | undefined): JsrRuntimeCompat | undefined {
	if (typeof runtimeCompat === 'undefined') {
		return undefined;
	}

	const compacted: JsrRuntimeCompat = {};
	for (const [key, value] of Object.entries(runtimeCompat)) {
		if (typeof value === 'boolean' || value === null) {
			compacted[key as keyof JsrRuntimeCompat] = value;
		}
	}

	return Object.keys(compacted).length > 0 ? compacted : undefined;
}

/**
 * Returns a trimmed string when the input is a non-empty string.
 */
function getTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
