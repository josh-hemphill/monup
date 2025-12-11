import antfu from '@antfu/eslint-config';

export default antfu({
	type: 'lib',
	formatters: true,
	pnpm: true,
	typescript: {
		tsconfigPath: 'tsconfig.json',
		overrides: {
			'ts/no-unsafe-assignment': 'off',
			'ts/no-unsafe-member-access': 'off',
			'ts/no-unsafe-return': 'off',
			'ts/no-unsafe-argument': 'off',
			'ts/no-unsafe-call': 'off',
			'ts/explicit-function-return-type': 'off',
		},
	},
	stylistic: {
		semi: true,
		indent: 'tab',
		quotes: 'single',
		overrides: {
			'style/quotes': [
				'warn',
				'single',
				{
					avoidEscape: true,
					allowTemplateLiterals: 'always',
				},
			],
			'style/comma-dangle': [
				'warn',
				'always-multiline',
			],
			'style/semi': [
				'warn',
				'always',
				{
					omitLastInOneLineBlock: true,
				},
			],
			'style/no-tabs': [
				'warn',
				{
					allowIndentationTabs: true,
				},
			],
			'style/space-before-function-paren': [
				'warn',
				'never',
			],
			'style/linebreak-style': [
				'warn',
				'unix',
			],
			'style/arrow-parens': [
				'warn',
				'always',
			],
		},
	},
}, {
	files: [
		'*.ts',
		'*.tsx',
	],
	languageOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	rules: {
		'no-console': 'warn',
		'no-debugger': 'warn',
		'strict': [
			'error',
			'global',
		],
		'eqeqeq': 'warn',
		'no-unneeded-ternary': [
			'warn',
		],
		'no-unused-vars': [
			'warn',
		],
		'ts/ban-ts-comment': 'warn',
		'import/no-named-default': 'off',
	},
}, {
	files: [
		'*.ts',
	],
	ignores: [
		'**/src/**/*.ts',
	],
	rules: {
		'no-console': 'off',
		'ts/no-unsafe-assignment': 'off',
		'ts/no-unsafe-call': 'off',
		'ts/no-unsafe-member-access': 'off',
		'ts/no-unsafe-return': 'off',
		'ts/no-unsafe-argument': 'off',
		'ts/no-unsafe-enum-comparison': 'off',
		'ts/no-unsafe-type-assertion': 'off',
	},
}).overrideRules({
	'antfu/no-top-level-await': 'off',
});
