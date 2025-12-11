/**
 * CI environment detection utilities
 */
import { env } from 'node:process';

/**
 * Detects if the current environment is a CI environment
 * Checks common CI environment variables
 */
export function detectCI(): boolean {
	// Check common CI environment variables
	const ciVars = [
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
	];

	for (const varName of ciVars) {
		if (typeof env[varName] === 'string') {
			return true;
		}
	}

	return false;
}
