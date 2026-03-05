import { defineConfig, type TestProjectConfiguration } from 'vitest/config';

export default defineConfig({
	test: {
		env: {
			LOG_LEVEL: 'debug',

		},
		projects: ['packages/*'],
	},
}) as TestProjectConfiguration;
