import { defineConfig, type TestUserConfig } from 'vitest/config';

export default defineConfig({
	test: {
		env: {
			LOG_LEVEL: 'debug',
		},
		globals: true,
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
	},
}) as TestUserConfig;
