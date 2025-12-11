import { build } from 'obuild';
import { defaultTransformConfig } from '../../scripts/oxc.default.ts';

await build({
	entries: [defaultTransformConfig({
		input: './src/',
	})],
});
