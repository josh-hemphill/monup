import type { Config } from 'ts-json-schema-generator';
import { writeFile } from 'node:fs/promises';
import { createGenerator } from 'ts-json-schema-generator';
import { logger } from './src/logger.ts';

const config: Config = {
	path: './src/types.ts',
	strictTuples: true,
	topRef: false,
	skipTypeCheck: true,
};
const generator = createGenerator(config);
const schema = generator.createSchema(config.type);
const schemaString = JSON.stringify(schema, null, 2);
logger.info(`schemaString length: ${schemaString.length}`);
await writeFile('./dist/config.schema.json', schemaString);
