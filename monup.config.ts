import type { MonupOptions } from '@monup/options';
import { defineConfig } from '@monup/options';

const config: MonupOptions = defineConfig({
	git: {
		tagStrategy: 'package', // Use package@version tags for monorepo
		tagTemplate: 'v%s',
		commit: true,
		push: true,
		tag: true,
	},
	changelog: {
		strategy: 'per-package',
		location: 'CHANGELOG.md',
		commitLinks: true,
		issueLinks: true,
		contributors: true,
	},
	release: {
		dryRun: 'auto', // Dry run locally, publish in CI
		// TODO: After migrating to OIDC trusted publishing, uncomment for npm attestation:
		// publishArgs: ['--provenance'],
	},
	github: {
		changelogMethod: 'auto',
	},
});

export default config;
