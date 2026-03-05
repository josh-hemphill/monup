/**
 * CI environment detection utilities
 */
import { env } from 'node:process';

const CI_VARS_LIST = [
	'CI',
	'CONTINUOUS_INTEGRATION',
	'GITHUB_ACTIONS',
	'GITLAB_CI',
	'CIRCLECI',
	'TRAVIS',
	'JENKINS_URL',
	'BUILDKITE',
	'TEAMCITY_VERSION',
	'APPVEYOR',
	'CODEBUILD_BUILD_ID',
	'BITBUCKET_COMMIT',
	'BITRISE_BUILD_SLUG',
	'SEMAPHORE',
	'DRONE',
	'AGOLA_CI',
	'WOODPECKER_CI',
] as const;

/** CI environment variable names that detectCI checks (exported for tests). */
export const CI_VARS: readonly string[] = CI_VARS_LIST;

/**
 * Detects if the current environment is a CI environment
 * Checks common CI environment variables
 */
export function detectCI(): boolean {
	// Check common CI environment variables

	for (const varName of CI_VARS_LIST) {
		if (typeof env[varName] === 'string') {
			return true;
		}
	}

	return false;
}
