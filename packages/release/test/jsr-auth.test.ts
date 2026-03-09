import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createJsrAuthorization,
	JsrAuthorizationDeniedError,
	JsrAuthorizationTimeoutError,
	pollJsrAuthorization,
	resolveJsrSetupToken,
} from '../src/index.ts';
import { logger } from '../src/logger.ts';

const HEX_TOKEN_PATTERN = /^[a-f0-9]+$/u;
const BASE64_TOKEN_PATTERN = /^[A-Za-z0-9+/=]+$/u;

describe('jsr auth helpers', () => {
	const originalToken = process.env.JSR_TOKEN;
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		process.env.JSR_TOKEN = 'jsrw_test_token';
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		process.env.JSR_TOKEN = originalToken;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('creates an authorization session with a generated challenge', async() => {
		const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
			verificationUrl: 'https://jsr.io/authorize/test',
			code: 'ABC123',
			exchangeToken: 'exchange-token',
			pollInterval: 3,
			expiresAt: '2099-01-01T00:00:00.000Z',
		}), { status: 200 }));

		const session = await createJsrAuthorization();

		expect(session).toMatchObject({
			verificationUrl: 'https://jsr.io/authorize/test',
			code: 'ABC123',
			exchangeToken: 'exchange-token',
			pollInterval: 3,
			expiresAt: '2099-01-01T00:00:00.000Z',
		});
		expect(session.verifier).toBeTypeOf('string');
		expect(session.challenge).toBeTypeOf('string');
		expect(session.verifier).not.toBe(session.challenge);
		expect(session.verifier).toMatch(HEX_TOKEN_PATTERN);
		expect(session.challenge).toMatch(BASE64_TOKEN_PATTERN);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.jsr.io/authorizations');
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
			method: 'POST',
		});
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"challenge"');
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(session.challenge);
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('"permissions"');
		expect(debugSpy).toHaveBeenCalledWith('Created JSR authorization session', expect.anything());
	});

	it('polls until authorization exchange succeeds', async() => {
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({
				code: 'authorizationPending',
				message: 'Authorization pending',
			}), { status: 400 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({
				token: 'jsrw_device_token',
				user: { id: 'user-id', name: 'Test User' },
			}), { status: 200 }));

		const sleepMock = vi.fn(async() => undefined);
		const onPendingMock = vi.fn(async() => undefined);

		const result = await pollJsrAuthorization({
			verificationUrl: 'https://jsr.io/authorize/test',
			code: 'ABC123',
			exchangeToken: 'exchange-token',
			pollInterval: 3,
			expiresAt: '2099-01-01T00:00:00.000Z',
			verifier: 'verifier',
			challenge: 'challenge',
		}, {
			onPending: onPendingMock,
			sleep: sleepMock,
		});

		expect(result).toEqual({
			token: 'jsrw_device_token',
			user: { id: 'user-id', name: 'Test User' },
		});
		expect(onPendingMock).toHaveBeenCalledWith(1);
		expect(sleepMock).toHaveBeenCalledWith(3000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.jsr.io/authorizations/exchange');
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
			method: 'POST',
			body: JSON.stringify({
				exchangeToken: 'exchange-token',
				verifier: 'verifier',
			}),
		});
	});

	it('fails with a timeout when approval never arrives', async() => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			code: 'authorizationPending',
			message: 'Authorization pending',
		}), { status: 400 }));

		const nowValues = [
			new Date('2026-01-01T00:00:00.000Z'),
			new Date('2026-01-01T00:00:00.000Z'),
			new Date('2026-01-01T00:00:05.000Z'),
		];

		await expect(pollJsrAuthorization({
			verificationUrl: 'https://jsr.io/authorize/test',
			code: 'ABC123',
			exchangeToken: 'exchange-token',
			pollInterval: 10,
			expiresAt: '2026-01-01T00:00:01.000Z',
			verifier: 'verifier',
			challenge: 'challenge',
		}, {
			now: () => nowValues.shift() ?? new Date('2026-01-01T00:00:05.000Z'),
			sleep: async() => undefined,
		})).rejects.toBeInstanceOf(JsrAuthorizationTimeoutError);
	});

	it('fails immediately when authorization is denied', async() => {
		const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
			code: 'authorizationDenied',
			message: 'Authorization denied',
		}), { status: 400 }));

		await expect(pollJsrAuthorization({
			verificationUrl: 'https://jsr.io/authorize/test',
			code: 'ABC123',
			exchangeToken: 'exchange-token',
			pollInterval: 3,
			expiresAt: '2099-01-01T00:00:00.000Z',
			verifier: 'verifier',
			challenge: 'challenge',
		})).rejects.toBeInstanceOf(JsrAuthorizationDeniedError);
		expect(debugSpy).toHaveBeenCalledWith(
			'JSR API request failed',
			expect.objectContaining({
				path: '/authorizations/exchange',
				code: 'authorizationDenied',
			}),
		);
	});

	it('resolves the token from explicit input or the environment', () => {
		expect(resolveJsrSetupToken('explicit-token')).toBe('explicit-token');
		expect(resolveJsrSetupToken()).toBe('jsrw_test_token');
		delete process.env.JSR_TOKEN;
		expect(resolveJsrSetupToken()).toBeUndefined();
	});
});
