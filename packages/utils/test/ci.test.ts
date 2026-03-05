import { env } from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CI_VARS, detectCI } from '../src/ci.ts';

describe('detectCI', () => {
	const originalEnv = { ...env };

	beforeEach(() => {
		// Clear exactly the CI vars that detectCI checks (so test works in CI)
		for (const key of CI_VARS) {
			delete env[key as keyof NodeJS.ProcessEnv];
		}
	});

	afterEach(() => {
		// Restore original env
		Object.keys(env).forEach((key) => {
			if (!(key in originalEnv)) {
				delete env[key];
			}
		});
		Object.assign(env, originalEnv);
	});

	it('should return false when no CI environment variables are set', () => {
		const result = detectCI();
		expect(result).toBe(false);
	});

	it('should return true when CI is set', () => {
		env.CI = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when CONTINUOUS_INTEGRATION is set', () => {
		env.CONTINUOUS_INTEGRATION = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when GITHUB_ACTIONS is set', () => {
		env.GITHUB_ACTIONS = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when GITLAB_CI is set', () => {
		env.GITLAB_CI = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when CIRCLECI is set', () => {
		env.CIRCLECI = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when TRAVIS is set', () => {
		env.TRAVIS = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when JENKINS_URL is set', () => {
		env.JENKINS_URL = 'http://jenkins.example.com';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when BUILDKITE is set', () => {
		env.BUILDKITE = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when TEAMCITY_VERSION is set', () => {
		env.TEAMCITY_VERSION = '2023.1';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when APPVEYOR is set', () => {
		env.APPVEYOR = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when CODEBUILD_BUILD_ID is set', () => {
		env.CODEBUILD_BUILD_ID = 'build-123';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when BITBUCKET_COMMIT is set', () => {
		env.BITBUCKET_COMMIT = 'abc123';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when BITRISE_BUILD_SLUG is set', () => {
		env.BITRISE_BUILD_SLUG = 'slug-123';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when SEMAPHORE is set', () => {
		env.SEMAPHORE = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when DRONE is set', () => {
		env.DRONE = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when AGOLA_CI is set', () => {
		env.AGOLA_CI = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});

	it('should return true when WOODPECKER_CI is set', () => {
		env.WOODPECKER_CI = 'true';
		const result = detectCI();
		expect(result).toBe(true);
	});
});
