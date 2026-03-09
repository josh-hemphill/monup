/**
 * JSR package setup helpers for local repository initialization.
 */
import type { PackageInfo } from '@monup/workspace';
import { parseJsonc } from '@monup/utils';
import { fs } from 'zx';
import packageJson from '../jsr.json' with { type: 'json' };
import { resolveJsrSetupToken } from './jsr-auth.ts';
import { logger } from './logger.ts';

const JSR_API_BASE_URL = 'https://api.jsr.io';
const JSR_PACKAGE_NAME_PATTERN = /^@([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;
const JSR_RUNTIME_COMPAT_KEYS = ['browser', 'deno', 'node', 'workerd', 'bun'] as const;

export type JsrReadmeSource = 'readme' | 'jsdoc';

export interface JsrGitHubRepository {
	owner: string;
	name: string;
}

export interface JsrRuntimeCompat {
	browser?: boolean | null;
	deno?: boolean | null;
	node?: boolean | null;
	workerd?: boolean | null;
	bun?: boolean | null;
}

export interface JsrSetupOptions {
	token?: string;
	githubRepository?: JsrGitHubRepository;
	readmeSource?: JsrReadmeSource;
	runtimeCompat?: JsrRuntimeCompat;
	description?: string;
	packageOverrides?: Record<string, JsrPackageSettings>;
}

export interface JsrPackageSettings {
	githubRepository?: JsrGitHubRepository;
	readmeSource?: JsrReadmeSource;
	runtimeCompat?: JsrRuntimeCompat;
	description?: string;
}

export interface JsrPackageSetupResult {
	packageName: string;
	created: boolean;
	updatedFields: string[];
	warnings: string[];
}

interface JsrPackageTarget {
	packageName: string;
	scope: string;
	package: string;
}

interface JsrApiErrorResponse {
	code?: unknown;
	message?: unknown;
}

interface JsrApiPackage {
	scope: string;
	name: string;
	description: string;
	githubRepository?: JsrGitHubRepository;
	readmeSource?: JsrReadmeSource;
	runtimeCompat?: JsrRuntimeCompat;
	[key: string]: unknown;
}

class JsrApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.name = 'JsrApiError';
		this.status = status;
		this.code = code;
	}
}

/**
 * Lists JSR-targeted package names from workspace package metadata.
 */
async function listJsrTargets(packages: PackageInfo[]): Promise<JsrPackageTarget[]> {
	const targets: JsrPackageTarget[] = [];
	const seen = new Set<string>();

	for (const pkg of packages) {
		const manifestPaths = pkg.packageFiles ?? (typeof pkg.packageFile === 'string' ? [pkg.packageFile] : []);
		for (const manifestPath of manifestPaths) {
			if (!isJsrManifestPath(manifestPath)) {
				continue;
			}

			const packageName = await readJsrPackageName(manifestPath);
			if (seen.has(packageName)) {
				continue;
			}

			const parsed = parseScopedPackageName(packageName);
			targets.push({
				packageName,
				scope: parsed.scope,
				package: parsed.package,
			});
			seen.add(packageName);
		}
	}

	return targets;
}

/**
 * Checks whether a manifest path points to a JSR manifest.
 */
function isJsrManifestPath(manifestPath: string): boolean {
	return manifestPath.endsWith('jsr.json') || manifestPath.endsWith('jsr.jsonc');
}

/**
 * Reads the JSR package name from a manifest file.
 */
async function readJsrPackageName(manifestPath: string): Promise<string> {
	const raw = await fs.readFile(manifestPath, 'utf-8');
	const manifest = parseJsonc<{ name?: unknown }>(raw);
	if (typeof manifest.name !== 'string') {
		throw new TypeError(`JSR manifest is missing a string name: ${manifestPath}`);
	}

	return manifest.name;
}

/**
 * Parses an @scope/package name into API path parts.
 */
function parseScopedPackageName(packageName: string): { scope: string; package: string } {
	const match = JSR_PACKAGE_NAME_PATTERN.exec(packageName);
	if (match === null) {
		throw new TypeError(`Invalid JSR package name: ${packageName}`);
	}

	const [, scope, pkg] = match;
	return {
		scope,
		package: pkg,
	};
}

/**
 * Creates a JSR API request with auth and tool identification headers.
 */
async function requestJsrApi<TResponse>(
	path: string,
	token: string,
	init: RequestInit = {},
): Promise<TResponse> {
	const response = await fetch(`${JSR_API_BASE_URL}${path}`, {
		...init,
		headers: {
			'Accept': 'application/json',
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'User-Agent': `${packageJson.name}/${packageJson.version}; https://github.com/monup/monup`,
			...init.headers,
		},
	});

	if (response.ok) {
		if (response.status === 204) {
			return undefined as TResponse;
		}

		return await response.json() as TResponse;
	}

	let errorPayload: JsrApiErrorResponse | undefined;
	try {
		errorPayload = await response.json() as JsrApiErrorResponse;
	}
	catch {
		errorPayload = undefined;
	}

	const code = typeof errorPayload?.code === 'string' ? errorPayload.code : undefined;
	const message = typeof errorPayload?.message === 'string'
		? errorPayload.message
		: `JSR API request failed with status ${response.status}`;

	throw new JsrApiError(message, response.status, code);
}

/**
 * Looks up an existing JSR package entry.
 */
async function getJsrPackage(
	scope: string,
	pkg: string,
	token: string,
): Promise<JsrApiPackage | undefined> {
	try {
		return await requestJsrApi<JsrApiPackage>(`/scopes/${scope}/packages/${pkg}`, token, {
			method: 'GET',
		});
	}
	catch(error: unknown) {
		if (error instanceof JsrApiError && error.status === 404) {
			return undefined;
		}

		throw error;
	}
}

/**
 * Creates a missing JSR package entry.
 */
async function createJsrPackage(
	scope: string,
	pkg: string,
	token: string,
): Promise<JsrApiPackage> {
	return requestJsrApi<JsrApiPackage>(`/scopes/${scope}/packages`, token, {
		method: 'POST',
		body: JSON.stringify({ package: pkg }),
	});
}

/**
 * Updates a single JSR package field.
 */
async function updateJsrPackage(
	scope: string,
	pkg: string,
	token: string,
	body: Record<string, unknown>,
): Promise<JsrApiPackage> {
	return requestJsrApi<JsrApiPackage>(`/scopes/${scope}/packages/${pkg}`, token, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

/**
 * Checks whether a create error means the package already exists.
 */
function isAlreadyExistsError(error: unknown): boolean {
	if (!(error instanceof JsrApiError)) {
		return false;
	}

	const parts = [error.code, error.message]
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.toLowerCase());
	return parts.some((value) => value.includes('already exists') || value.includes('already taken'));
}

/**
 * Checks whether the requested GitHub link differs from the current one.
 */
function shouldUpdateGitHubRepository(
	current: JsrApiPackage,
	desired: JsrGitHubRepository | undefined,
): desired is JsrGitHubRepository {
	if (typeof desired === 'undefined') {
		return false;
	}

	return current.githubRepository?.owner !== desired.owner
		|| current.githubRepository?.name !== desired.name;
}

/**
 * Checks whether the requested readme source differs from the current one.
 */
function shouldUpdateReadmeSource(
	current: JsrApiPackage,
	desired: JsrReadmeSource | undefined,
): desired is JsrReadmeSource {
	return typeof desired === 'string' && current.readmeSource !== desired;
}

/**
 * Checks whether the requested description differs from the current one.
 */
function shouldUpdateDescription(
	current: JsrApiPackage,
	desired: string | undefined,
): desired is string {
	return typeof desired === 'string' && desired.length > 0 && current.description !== desired;
}

/**
 * Keeps only explicitly configured runtime compatibility keys.
 */
function normalizeRuntimeCompat(runtimeCompat: JsrRuntimeCompat | undefined): JsrRuntimeCompat | undefined {
	if (typeof runtimeCompat === 'undefined') {
		return undefined;
	}

	const normalized: JsrRuntimeCompat = {};
	for (const key of JSR_RUNTIME_COMPAT_KEYS) {
		const value = runtimeCompat[key];
		if (typeof value === 'boolean' || value === null) {
			normalized[key] = value;
		}
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Merges shared settings with package-specific overrides.
 */
function resolvePackageSettings(
	options: JsrSetupOptions,
	packageName: string,
): JsrPackageSettings {
	const packageOverride = options.packageOverrides?.[packageName];
	const sharedRuntimeCompat = normalizeRuntimeCompat(options.runtimeCompat);
	const overrideRuntimeCompat = normalizeRuntimeCompat(packageOverride?.runtimeCompat);

	return {
		githubRepository: packageOverride?.githubRepository ?? options.githubRepository,
		readmeSource: packageOverride?.readmeSource ?? options.readmeSource,
		description: packageOverride?.description ?? options.description,
		runtimeCompat: typeof overrideRuntimeCompat === 'undefined'
			? sharedRuntimeCompat
			: {
					...(sharedRuntimeCompat ?? {}),
					...overrideRuntimeCompat,
				},
	};
}

/**
 * Checks whether the requested runtime compatibility differs from the current one.
 */
function shouldUpdateRuntimeCompat(
	current: JsrApiPackage,
	desired: JsrRuntimeCompat | undefined,
): desired is JsrRuntimeCompat {
	if (typeof desired === 'undefined') {
		return false;
	}

	for (const [key, value] of Object.entries(desired)) {
		const currentValue = current.runtimeCompat?.[key as keyof JsrRuntimeCompat];
		if (currentValue !== value) {
			return true;
		}
	}

	return false;
}

/**
 * Creates missing JSR packages and applies shared settings.
 */
export async function setupJsrPackages(
	packages: PackageInfo[],
	options: JsrSetupOptions = {},
): Promise<JsrPackageSetupResult[]> {
	const token = resolveJsrSetupToken(options.token);
	if (typeof token !== 'string') {
		throw new TypeError('JSR setup requires the JSR_TOKEN environment variable.');
	}

	const targets = await listJsrTargets(packages);
	if (targets.length === 0) {
		logger.warn('No JSR packages found in workspace');
		return [];
	}

	const results: JsrPackageSetupResult[] = [];
	for (const target of targets) {
		logger.info('Configuring JSR package', { packageName: target.packageName });
		const warnings: string[] = [];
		const updatedFields: string[] = [];
		const packageSettings = resolvePackageSettings(options, target.packageName);

		let remotePackage = await getJsrPackage(target.scope, target.package, token);
		let created = false;

		if (typeof remotePackage === 'undefined') {
			try {
				remotePackage = await createJsrPackage(target.scope, target.package, token);
				created = true;
				logger.info('Created JSR package', { packageName: target.packageName });
			}
			catch(error: unknown) {
				if (!isAlreadyExistsError(error)) {
					throw error;
				}

				const warning = `JSR package already exists: ${target.packageName}`;
				warnings.push(warning);
				logger.warn(warning);
				remotePackage = await getJsrPackage(target.scope, target.package, token);
				if (typeof remotePackage === 'undefined') {
					throw error;
				}
			}
		}
		else {
			const warning = `JSR package already exists: ${target.packageName}`;
			warnings.push(warning);
			logger.warn(warning);
		}

		if (shouldUpdateDescription(remotePackage, packageSettings.description)) {
			remotePackage = await updateJsrPackage(target.scope, target.package, token, {
				description: packageSettings.description,
			});
			updatedFields.push('description');
		}

		if (shouldUpdateGitHubRepository(remotePackage, packageSettings.githubRepository)) {
			remotePackage = await updateJsrPackage(target.scope, target.package, token, {
				githubRepository: packageSettings.githubRepository,
			});
			updatedFields.push('githubRepository');
		}

		if (shouldUpdateReadmeSource(remotePackage, packageSettings.readmeSource)) {
			remotePackage = await updateJsrPackage(target.scope, target.package, token, {
				readmeSource: packageSettings.readmeSource,
			});
			updatedFields.push('readmeSource');
		}

		if (shouldUpdateRuntimeCompat(remotePackage, packageSettings.runtimeCompat)) {
			remotePackage = await updateJsrPackage(target.scope, target.package, token, {
				runtimeCompat: packageSettings.runtimeCompat,
			});
			updatedFields.push('runtimeCompat');
		}

		results.push({
			packageName: target.packageName,
			created,
			updatedFields,
			warnings,
		});
	}

	return results;
}
