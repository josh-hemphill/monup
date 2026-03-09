# @monup/options

Configuration contract and option resolution for Monup.

## Workflow Role

`@monup/options` sits underneath every workflow step. The CLI uses it to load `monup.config.ts`, merge overrides, and normalize options before running `version`, `changelog`, `release`, or `github`.

## Main Exports

  - `defineConfig()`: type-safe helper for `monup.config.ts`.
  - `resolveOptions()`: load config and merge overrides into resolved options.
  - `defaultOptions`: shared defaults for Monup packages.
  - `MonupOptions` and `ResolvedMonupOptions`: main option types.
  - `LogLevel`, `LogLevelConfig`, and conventional config types.

## Example

```ts
import { defineConfig, resolveOptions } from '@monup/options';

export default defineConfig({
  git: { tagStrategy: 'package' },
  release: { dryRun: 'auto' },
});

const options = await resolveOptions({
  logLevel: { default: 'debug' },
});
```

## Related Packages

  - [`@monup/cli`](../cli/README.md): passes CLI flags and config overrides here.
  - [`@monup/version`](../version/README.md): consumes resolved version options.
  - [`@monup/release`](../release/README.md): consumes resolved release options.
