/**
 * JSR interactive authorization helpers.
 */
import { createHash, randomBytes } from 'node:crypto';
import { env } from 'node:process';
import packageJson from '../jsr.json' with { type: 'json' };
import { logger } from './logger.ts';

const JSR_API_BASE_URL = 'https://api.jsr.io';

export interface JsrAuthorizationPermission {
	permission: 'package/publish';
	scope: string;
	package?: string;
	version?: string;
	tarballHash?: string;
}

export interface JsrAuthorizationSession {
	verificationUrl: string;
	code: string;
	exchangeToken: string;
	pollInterval: number;
	expiresAt: string;
	verifier: string;
	challenge: string;
}

export interface JsrAuthorizationUser {
	id: string;
	name?: string;
	avatarUrl?: string;
	githubId?: number | null;
}

export interface JsrAuthorizationResult {
	token: string;
	user: JsrAuthorizationUser;
}

export interface PollJsrAuthorizationOptions {
	now?: () => Date;
	onPending?: (attempt: number) => void | Promise<void>;
	sleep?: (ms: number) => Promise<void>;
}

interface JsrApiErrorResponse {
	code?: unknown;
	message?: unknown;
}

interface CreateAuthorizationRequest {
	challenge: string;
	permissions?: JsrAuthorizationPermission[];
}

interface CreateAuthorizationResponse {
	verificationUrl: string;
	code: string;
	exchangeToken: string;
	pollInterval: number;
	expiresAt: string;
}

interface AuthorizationExchangeRequest {
	exchangeToken: string;
	verifier: string;
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

export class JsrAuthorizationTimeoutError extends Error {
	constructor(message = 'JSR authorization timed out before approval.') {
		super(message);
		this.name = 'JsrAuthorizationTimeoutError';
	}
}

export class JsrAuthorizationDeniedError extends Error {
	constructor(message = 'JSR authorization was denied.') {
		super(message);
		this.name = 'JsrAuthorizationDeniedError';
	}
}

/**
 * Resolves a JSR token from an explicit value or the environment.
 */
export function resolveJsrSetupToken(token?: string): string | undefined {
	const resolvedToken = token ?? env.JSR_TOKEN;
	return typeof resolvedToken === 'string' && resolvedToken.length > 0
		? resolvedToken
		: undefined;
}

/**
 * Creates an interactive JSR authorization session.
 */
export async function createJsrAuthorization(
	permissions?: JsrAuthorizationPermission[],
): Promise<JsrAuthorizationSession> {
	const { challenge, verifier } = createAuthorizationChallengePair();
	const requestBody: CreateAuthorizationRequest = typeof permissions === 'undefined' || permissions.length === 0
		? { challenge }
		: { challenge, permissions };
	const response = await requestJsrApi<CreateAuthorizationResponse>('/authorizations', {
		method: 'POST',
		body: JSON.stringify(requestBody),
	});
	logger.debug('Created JSR authorization session', {
		verificationUrl: response.verificationUrl,
		code: response.code,
		pollInterval: response.pollInterval,
		expiresAt: response.expiresAt,
		permissions: permissions ?? [],
		exchangeTokenPreview: maskSecret(response.exchangeToken),
	});

	return {
		...response,
		challenge,
		verifier,
	};
}

/**
 * Exchanges an approved authorization session for a device token.
 */
export async function exchangeJsrAuthorization(
	session: JsrAuthorizationSession,
): Promise<JsrAuthorizationResult> {
	const requestBody: AuthorizationExchangeRequest = {
		exchangeToken: session.exchangeToken,
		verifier: session.verifier,
	};
	logger.debug('Exchanging JSR authorization session', {
		code: session.code,
		exchangeTokenPreview: maskSecret(session.exchangeToken),
		verifierPreview: maskSecret(session.verifier),
		expiresAt: session.expiresAt,
	});

	return requestJsrApi<JsrAuthorizationResult>('/authorizations/exchange', {
		method: 'POST',
		body: JSON.stringify(requestBody),
	});
}

/**
 * Polls until a JSR authorization is approved or expires.
 */
export async function pollJsrAuthorization(
	session: JsrAuthorizationSession,
	options: PollJsrAuthorizationOptions = {},
): Promise<JsrAuthorizationResult> {
	const now = options.now ?? (() => new Date());
	const sleep = options.sleep ?? defaultSleep;
	const pollIntervalMs = Math.max(session.pollInterval, 1) * 1000;
	const expiresAt = new Date(session.expiresAt);
	let attempt = 0;

	while (now().getTime() < expiresAt.getTime()) {
		try {
			return await exchangeJsrAuthorization(session);
		}
		catch (error: unknown) {
			logger.debug('JSR authorization exchange attempt failed', {
				attempt: attempt + 1,
				code: session.code,
				error: getErrorMessage(error),
				errorCode: error instanceof JsrApiError ? error.code : undefined,
				status: error instanceof JsrApiError ? error.status : undefined,
			});
			if (isDeniedAuthorizationError(error)) {
				throw new JsrAuthorizationDeniedError(getErrorMessage(error));
			}
			if (!isPendingAuthorizationError(error)) {
				throw error;
			}

			attempt += 1;
			await options.onPending?.(attempt);
			const remainingMs = expiresAt.getTime() - now().getTime();
			if (remainingMs <= 0) {
				break;
			}

			await sleep(Math.min(pollIntervalMs, remainingMs));
		}
	}

	throw new JsrAuthorizationTimeoutError();
}

/**
 * Creates a challenge/verifier pair for device authorization.
 */
function createAuthorizationChallengePair(): { challenge: string; verifier: string } {
	const verifier = randomBytes(32).toString('hex');
	const challenge = createHash('sha256')
		.update(verifier)
		.digest('base64');
	return {
		challenge,
		verifier,
	};
}

/**
 * Executes a JSR API request with optional bearer authentication.
 */
async function requestJsrApi<TResponse>(
	path: string,
	init: RequestInit = {},
	token?: string,
): Promise<TResponse> {
	const method = init.method ?? 'GET';
	const headers = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'User-Agent': `${packageJson.name}/${packageJson.version}; https://github.com/monup/monup`,
		...(typeof token === 'string' ? { Authorization: `Bearer ${token}` } : {}),
		...init.headers,
	};

	const response = await fetch(`${JSR_API_BASE_URL}${path}`, {
		...init,
		headers,
	});

	if (response.ok) {
		logger.debug('JSR API request succeeded', {
			method,
			path,
			status: response.status,
		});
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
	logger.debug('JSR API request failed', {
		method,
		path,
		status: response.status,
		code,
		message,
	});

	throw new JsrApiError(message, response.status, code);
}

/**
 * Identifies exchange failures that should continue polling.
 */
function isPendingAuthorizationError(error: unknown): boolean {
	if (!(error instanceof JsrApiError) || error.status !== 400) {
		return false;
	}

	if (isDeniedAuthorizationError(error) || isExpiredAuthorizationError(error)) {
		return false;
	}

	return true;
}

/**
 * Identifies exchange failures that indicate explicit denial.
 */
function isDeniedAuthorizationError(error: unknown): boolean {
	return hasAuthorizationErrorFragment(error, ['deny', 'denied']);
}

/**
 * Identifies exchange failures that indicate expiration.
 */
function isExpiredAuthorizationError(error: unknown): boolean {
	return hasAuthorizationErrorFragment(error, ['expired', 'expires']);
}

/**
 * Checks auth error code/message fragments.
 */
function hasAuthorizationErrorFragment(error: unknown, fragments: string[]): boolean {
	if (!(error instanceof JsrApiError)) {
		return false;
	}

	const parts = [error.code, error.message]
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.toLowerCase());
	return fragments.some((fragment) => parts.some((value) => value.includes(fragment)));
}

/**
 * Returns a usable error message for auth failures.
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

/**
 * Sleeps for the requested polling interval.
 */
async function defaultSleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Masks sensitive auth material in debug logs.
 */
function maskSecret(value: string): string {
	if (value.length <= 8) {
		return `${value.slice(0, 2)}***`;
	}

	return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
